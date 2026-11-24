import { Router } from 'express';
import { getFirebaseAuth } from '../config/firebase.js';
import { User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { createSessionToken } from '../utils/sessions.js';

const router = Router();

function makeUsername(name) {
  const base = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18) || 'friend';
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

router.post('/google', async (req, res, next) => {
  try {
    const { idToken } = req.body;
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
      let username = makeUsername(decoded.name);
      while (await User.exists({ username })) username = makeUsername(decoded.name);
      user = await User.create({
        googleId: decoded.uid,
        name: decoded.name,
        email: decoded.email,
        photoURL: decoded.picture || '',
        username,
      });
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
      needsUsername: isNewUser,
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
    if (req.session) {
      req.session.revokedAt = new Date();
      await req.session.save();
    }
    res.json({ success: true });
  } catch (error) {
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
