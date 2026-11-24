import { Router } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { getFirebaseAuth } from '../config/firebase.js';
import {
  Call,
  Group,
  GroupMessage,
  Media,
  Message,
  Notification,
  Session,
  Status,
  User,
} from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { createSessionToken } from '../utils/sessions.js';

const router = Router();

router.post('/google', async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    if (typeof idToken !== 'string' || !idToken) {
      return res.status(400).json({ error: 'A Firebase ID token is required.' });
    }
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    if (!decoded.email || !decoded.name) {
      return res.status(401).json({ error: 'Google account did not provide a name and email.' });
    }
    let user = await User.findOne({ googleId: decoded.uid });
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const username = await User.generateUniqueUsername(decoded.email);
        try {
          user = await User.create({
            googleId: decoded.uid,
            name: decoded.name,
            email: decoded.email,
            photoURL: decoded.picture || '',
            username,
          });
          break;
        } catch (error) {
          const usernameConflict = error.code === 11000 &&
            (error.keyPattern?.username || error.keyValue?.username);
          if (!usernameConflict || attempt === 4) throw error;
        }
      }
    } else {
      user.name = decoded.name;
      user.email = decoded.email;
      if (user.photoURL && user.photoURL !== decoded.picture) user.hasCustomPhoto = true;
      if (!user.hasCustomPhoto) user.photoURL = decoded.picture || user.photoURL;
      await user.save();
    }
    const { token } = await createSessionToken(user.id);
    res.json({
      token,
      isNewUser,
      needsUsername: false,
      user: user.toObject(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const session = req.session ? null : await createSessionToken(req.user.id);
    res.json({ user: req.user, token: session?.token || null });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    req.session.revokedAt = new Date();
    await req.session.save();
    req.app.get('io').in(`session:${req.session.id}`).disconnectSockets(true);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/delete-account', requireAuth, async (req, res, next) => {
  try {
    const idToken = req.body?.idToken;
    if (typeof idToken !== 'string' || !idToken) {
      return res.status(400).json({ error: 'A Firebase ID token is required.' });
    }
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    if (decoded.uid !== req.user.googleId) {
      return res.status(403).json({ error: 'The authenticated account does not match.' });
    }

    const userId = req.user.id;
    const googleId = req.user.googleId;
    const deleted = {
      messages: 0,
      groupMessages: 0,
      statuses: 0,
      mediaDocuments: 0,
      cloudinaryFiles: 0,
      notifications: 0,
      sessions: 0,
      calls: 0,
      firebase: false,
    };
    const errors = [];

    const media = await Media.find({ owner: userId }).select('publicId resourceType');
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      for (const file of media) {
        try {
          await cloudinary.uploader.destroy(file.publicId, {
            resource_type: file.resourceType || 'image',
            invalidate: true,
          });
          deleted.cloudinaryFiles++;
        } catch (error) {
          errors.push(`Cloudinary ${file.publicId}: ${error.message}`);
        }
      }
    } else {
      errors.push('Cloudinary credentials are not configured.');
    }

    await Promise.all([
      Message.deleteMany({
        $or: [{ sender: userId }, { receiver: userId }],
      }).then((result) => { deleted.messages = result.deletedCount; }),
      GroupMessage.deleteMany({
        sender: userId,
      }).then((result) => { deleted.groupMessages = result.deletedCount; }),
      Status.deleteMany({ user: userId }).then((result) => { deleted.statuses = result.deletedCount; }),
      Media.deleteMany({ owner: userId }).then((result) => { deleted.mediaDocuments = result.deletedCount; }),
      Notification.deleteMany({ $or: [{ recipient: userId }, { actor: userId }] })
        .then((result) => { deleted.notifications = result.deletedCount; }),
      Session.deleteMany({ user: userId }).then((result) => { deleted.sessions = result.deletedCount; }),
      Call.deleteMany({ $or: [{ caller: userId }, { receiver: userId }] })
        .then((result) => { deleted.calls = result.deletedCount; }),
      Group.updateMany(
        { $or: [{ members: userId }, { admins: userId }] },
        { $pull: { members: userId, admins: userId } },
      ),
    ]);

    try {
      await getFirebaseAuth().deleteUser(googleId);
      deleted.firebase = true;
    } catch (error) {
      errors.push(`Firebase: ${error.message}`);
    }

    await User.deleteOne({ _id: userId });

    if (errors.length) {
      console.error(`Partial account deletion for user ${userId}:`, errors.join('; '));
      return res.status(207).json({
        success: false,
        deleted,
        error: 'Account deletion completed with some cleanup errors.',
      });
    }

    console.info(`Account deleted for user ${userId}:`, deleted);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error('Account deletion failed:', error.message);
    next(error);
  }
});

router.patch('/username', requireAuth, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Use 3–20 letters, numbers, or underscores.' });
    }
    const taken = await User.exists({ username, _id: { $ne: req.user.id } });
    if (taken) return res.status(409).json({ error: 'That username is already taken.' });
    req.user.username = username;
    await req.user.save();
    req.app.get('io').to(`user:${req.user.id}`).emit('account_updated', req.user.toObject());
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});

export default router;
