import { Router } from 'express';
import mongoose from 'mongoose';
import { Group, Media, Message, Status, User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeVisibleUser } from '../utils/privacy.js';
import { canViewStatus } from '../utils/statusAccess.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [sentTo, receivedFrom, groups] = await Promise.all([
      Message.distinct('receiver', { sender: req.user.id, receiver: { $ne: null } }),
      Message.distinct('sender', { receiver: req.user.id }),
      Group.find({ members: req.user.id }).select('members'),
    ]);
    const contactIds = [...new Set([
      ...sentTo.map(String),
      ...receivedFrom.map(String),
      ...groups.flatMap((group) => group.members.map(String)),
    ])].filter((id) => id !== req.user.id);
    const contacts = contactIds.length
      ? await User.find({ _id: { $in: contactIds, $nin: req.user.blockedUsers }, blockedUsers: { $ne: req.user.id } }).select('_id')
      : [];
    const userIds = [req.user.id, ...contacts.map((contact) => contact.id)];
    const statuses = await Status.find({ user: { $in: userIds }, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: 1 })
      .populate('user', 'name username photoURL privacy');
    res.json({ statuses: statuses.map((status) => {
      const visibleStatus = status.toObject();
      visibleStatus.user = serializeVisibleUser(status.user, true);
      return visibleStatus;
    }) });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { type, content = '', fileURL = '', mediaId, backgroundColor = '#075e54' } = req.body;
    if (!['image', 'video', 'text'].includes(type)) return res.status(400).json({ error: 'Unsupported status type.' });
    if (type === 'text' && !String(content).trim()) return res.status(400).json({ error: 'Text status cannot be empty.' });
    if (type !== 'text' && !fileURL) return res.status(400).json({ error: 'Upload a file for this status.' });
    let media = null;
    if (mediaId) {
      if (!mongoose.isValidObjectId(mediaId)) return res.status(400).json({ error: 'Invalid status media.' });
      media = await Media.findOne({ _id: mediaId, owner: req.user.id });
      const expectedResourceType = type === 'image' ? 'image' : 'video';
      if (!media || media.secureURL !== fileURL || media.resourceType !== expectedResourceType) {
        return res.status(400).json({ error: 'The status media is not available.' });
      }
    }
    const status = await Status.create({
      user: req.user.id,
      type,
      content: String(content).slice(0, 700),
      fileURL: String(fileURL),
      media: media?._id || null,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(backgroundColor) ? backgroundColor : '#075e54',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    req.app.get('io').to(`user:${req.user.id}`).emit('statuses_updated');
    res.status(201).json({ status });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/view', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid status id.' });
    const statusOwner = await Status.findOne({
      _id: req.params.id,
      expiresAt: { $gt: new Date() },
    }).select('user');
    if (!statusOwner) return res.status(404).json({ error: 'Status not found or expired.' });

    if (!statusOwner.user.equals(req.user.id)) {
      const [owner, sentMessage, receivedMessage, sharedGroup] = await Promise.all([
        User.findById(statusOwner.user).select('blockedUsers'),
        Message.exists({ sender: req.user.id, receiver: statusOwner.user, group: null }),
        Message.exists({ sender: statusOwner.user, receiver: req.user.id, group: null }),
        Group.exists({ members: { $all: [req.user.id, statusOwner.user] } }),
      ]);
      const isContact = Boolean(sentMessage || receivedMessage || sharedGroup);
      if (!owner || !canViewStatus({
        ownerId: statusOwner.user,
        viewerId: req.user.id,
        viewerBlockedUsers: req.user.blockedUsers,
        ownerBlockedUsers: owner.blockedUsers,
        isContact,
      })) {
        return res.status(404).json({ error: 'Status not found or expired.' });
      }
    }

    const status = await Status.findOneAndUpdate(
      { _id: req.params.id, expiresAt: { $gt: new Date() } },
      { $addToSet: { viewers: req.user.id } },
      { new: true },
    );
    if (!status) return res.status(404).json({ error: 'Status not found or expired.' });
    req.app.get('io').to(`user:${status.user}`).emit('statuses_updated');
    res.json({ status });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await Status.deleteOne({ _id: req.params.id, user: req.user.id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Status not found.' });
    req.app.get('io').to(`user:${req.user.id}`).emit('statuses_updated');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
