import { Router } from 'express';
import mongoose from 'mongoose';
import { Group, Media, User, Message } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeVisibleUser } from '../utils/privacy.js';

const router = Router();
router.use(requireAuth);

async function getContactIds(userId) {
  const [sent, received, groups] = await Promise.all([
    Message.distinct('receiver', { sender: userId, receiver: { $ne: null } }),
    Message.distinct('sender', { receiver: userId }),
    Group.find({ members: userId }).select('members'),
  ]);
  return new Set([
    ...sent.map(String),
    ...received.map(String),
    ...groups.flatMap((group) => group.members.map(String)),
  ]);
}

router.get('/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) return res.json({ users: [] });
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const [users, contacts] = await Promise.all([User.find({
      _id: { $ne: req.user.id, $nin: req.user.blockedUsers },
      blockedUsers: { $ne: req.user.id },
      $or: [{ name: { $regex: escaped, $options: 'i' } }, { username: { $regex: `^${escaped}`, $options: 'i' } }],
    }).select('name username photoURL bio isOnline lastSeen privacy').limit(20), getContactIds(req.user.id)]);
    res.json({ users: users.map((user) => serializeVisibleUser(user, contacts.has(user.id))) });
  } catch (error) {
    next(error);
  }
});

router.get('/availability/:username', async (req, res, next) => {
  try {
    const username = String(req.params.username).toLowerCase();
    const exists = await User.exists({ username, _id: { $ne: req.user.id } });
    res.json({ available: !exists });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
    const user = await User.findById(req.params.id).select('name username photoURL bio isOnline lastSeen createdAt privacy');
    if (!user || req.user.blockedUsers.some((id) => id.equals(user.id)) ||
        await User.exists({ _id: req.params.id, blockedUsers: req.user.id })) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const contacts = await getContactIds(req.user.id);
    res.json({ user: serializeVisibleUser(user, user.id === req.user.id || contacts.has(user.id)) });
  } catch (error) {
    next(error);
  }
});

router.put('/profile', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const bio = String(req.body.bio || '').trim();
    if (!name || name.length > 80) return res.status(400).json({ error: 'Name must be 1–80 characters.' });
    if (bio.length > 100) return res.status(400).json({ error: 'Bio must be at most 100 characters.' });
    const { photoURL, photoMediaId } = req.body;
    if (photoURL !== undefined && typeof photoURL !== 'string') {
      return res.status(400).json({ error: 'Profile photo URL must be a string.' });
    }
    if (photoMediaId !== undefined) {
      if (!mongoose.isValidObjectId(photoMediaId)) return res.status(400).json({ error: 'Invalid profile photo.' });
      const media = await Media.findOne({ _id: photoMediaId, owner: req.user.id, resourceType: 'image' });
      if (!media || media.secureURL !== photoURL) return res.status(400).json({ error: 'The profile photo is not available.' });
      req.user.photoMedia = media._id;
      req.user.hasCustomPhoto = true;
    } else if (photoURL !== undefined && photoURL !== req.user.photoURL) {
      req.user.photoMedia = null;
      req.user.hasCustomPhoto = true;
    }
    req.user.name = name;
    req.user.bio = bio;
    if (photoURL !== undefined) req.user.photoURL = photoURL;
    await req.user.save();
    req.app.get('io').to(`user:${req.user.id}`).emit('account_updated', req.user.toObject());
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});

router.put('/privacy', async (req, res, next) => {
  try {
    const { lastSeen, photo, online, readReceipts } = req.body;
    const choices = {
      lastSeen: ['everyone', 'contacts', 'nobody'],
      photo: ['everyone', 'contacts', 'nobody'],
      online: ['everyone', 'nobody'],
    };
    for (const [field, values] of Object.entries(choices)) {
      if (req.body[field] !== undefined && !values.includes(req.body[field])) {
        return res.status(400).json({ error: `Invalid ${field} visibility setting.` });
      }
    }
    if (readReceipts !== undefined && typeof readReceipts !== 'boolean') {
      return res.status(400).json({ error: 'readReceipts must be a boolean.' });
    }
    for (const field of ['lastSeen', 'photo', 'online', 'readReceipts']) {
      if (req.body[field] !== undefined) req.user.privacy[field] = req.body[field];
    }
    await req.user.save();
    req.app.get('io').to(`user:${req.user.id}`).emit('account_updated', req.user.toObject());
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});

router.post('/block/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    if (!await User.exists({ _id: req.params.id })) return res.status(404).json({ error: 'User not found.' });
    req.user.blockedUsers.addToSet(req.params.id);
    await req.user.save();
    req.app.get('io').to(`user:${req.user.id}`).emit('account_updated', req.user.toObject());
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/block/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid user id.' });
    req.user.blockedUsers.pull(req.params.id);
    await req.user.save();
    req.app.get('io').to(`user:${req.user.id}`).emit('account_updated', req.user.toObject());
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const { theme, notifications } = req.body;
    if (theme !== undefined && !['light', 'dark'].includes(theme)) {
      return res.status(400).json({ error: 'Theme must be light or dark.' });
    }
    if (notifications !== undefined && typeof notifications !== 'boolean') {
      return res.status(400).json({ error: 'notifications must be a boolean.' });
    }
    if (theme !== undefined) req.user.settings.theme = theme;
    if (notifications !== undefined) req.user.settings.notifications = notifications;
    await req.user.save();
    req.app.get('io').to(`user:${req.user.id}`).emit('account_updated', req.user.toObject());
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});

router.get('/stats/me', async (req, res, next) => {
  try {
    const totalChats = await Message.distinct('sender', { receiver: req.user.id });
    res.json({ totalChats: totalChats.length });
  } catch (error) {
    next(error);
  }
});

export default router;
