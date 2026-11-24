import { Router } from 'express';
import mongoose from 'mongoose';
import { Group, Message, User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeVisibleUser } from '../utils/privacy.js';

const router = Router();
router.use(requireAuth);

router.get('/conversations', async (req, res, next) => {
  try {
    const messages = await Message.find({
      group: null,
      $or: [{ sender: req.user.id }, { receiver: req.user.id }],
      deletedFor: { $ne: req.user.id },
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('sender', 'name username photoURL isOnline lastSeen privacy')
      .populate('receiver', 'name username photoURL isOnline lastSeen privacy');
    const latest = new Map();
    for (const message of messages) {
      const peer = message.sender.id === req.user.id ? message.receiver : message.sender;
      if (peer && !latest.has(peer.id)) {
        const lastMessage = message.toObject();
        lastMessage.sender = serializeVisibleUser(message.sender, true);
        lastMessage.receiver = message.receiver ? serializeVisibleUser(message.receiver, true) : null;
        latest.set(peer.id, {
          user: serializeVisibleUser(peer, true),
          lastMessage,
          unread: message.receiver?.id === req.user.id && message.status !== 'read' ? 1 : 0,
        });
      } else if (peer && latest.has(peer.id) && message.receiver?.id === req.user.id && message.status !== 'read') {
        latest.get(peer.id).unread += 1;
      }
    }
    res.json({ conversations: [...latest.values()] });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { userId, groupId } = req.query;
    let filter;
    if (groupId && mongoose.isValidObjectId(groupId)) {
      const group = await Group.findOne({ _id: groupId, members: req.user.id });
      if (!group) return res.status(404).json({ error: 'Group not found.' });
      filter = { group: groupId, deletedFor: { $ne: req.user.id } };
    } else if (userId && mongoose.isValidObjectId(userId)) {
      if (req.user.blockedUsers.some((id) => id.equals(userId))) return res.status(403).json({ error: 'This contact is blocked.' });
      filter = {
        group: null,
        deletedFor: { $ne: req.user.id },
        $or: [
          { sender: req.user.id, receiver: userId },
          { sender: userId, receiver: req.user.id },
        ],
      };
    } else {
      return res.status(400).json({ error: 'A valid userId or groupId is required.' });
    }
    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name username photoURL privacy')
      .populate('replyTo', 'content sender type');
    const visibleMessages = messages.reverse().map((message) => {
      const result = message.toObject();
      if (result.sender) result.sender = serializeVisibleUser(message.sender, true);
      return result;
    });
    res.json({ messages: visibleMessages });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { to, groupId, type = 'text', content = '', fileURL = '', fileName = '', fileSize = 0, replyTo } = req.body;
    const allowedTypes = ['text', 'image', 'video', 'audio', 'document'];
    if (!allowedTypes.includes(type) || (type === 'text' && !String(content).trim())) {
      return res.status(400).json({ error: 'Message content or type is invalid.' });
    }
    let receiver = null;
    let group = null;
    if (groupId) {
      group = await Group.findOne({ _id: groupId, members: req.user.id });
      if (!group) return res.status(404).json({ error: 'Group not found.' });
      if (group.onlyAdminCanMessage && !group.admins.some((id) => id.equals(req.user.id))) {
        return res.status(403).json({ error: 'Only group admins can send messages.' });
      }
    } else {
      receiver = await User.findById(to);
      if (!receiver) return res.status(404).json({ error: 'Recipient not found.' });
      if (req.user.blockedUsers.some((id) => id.equals(receiver.id)) ||
          receiver.blockedUsers.some((id) => id.equals(req.user.id))) {
        return res.status(403).json({ error: 'Messages cannot be sent to this contact.' });
      }
    }
    const message = await Message.create({
      sender: req.user.id,
      receiver: receiver?.id || null,
      group: group?.id || null,
      type,
      content: String(content).slice(0, 10000),
      fileURL: String(fileURL).slice(0, 2048),
      fileName: String(fileName).slice(0, 200),
      fileSize: Number(fileSize) || 0,
      replyTo: replyTo && mongoose.isValidObjectId(replyTo) ? replyTo : null,
      status: receiver?.isOnline ? 'delivered' : 'sent',
    });
    const populated = await message.populate('sender', 'name username photoURL');
    const io = req.app.get('io');
    if (group) {
      for (const memberId of group.members) {
        if (!memberId.equals(req.user.id)) io.to(`user:${memberId}`).emit('receive_message', populated);
      }
    } else {
      io.to(`user:${receiver.id}`).emit('receive_message', populated);
      io.to(`user:${req.user.id}`).emit('receive_message', populated);
      if (receiver.isOnline) {
        io.to(`user:${req.user.id}`).emit('message_status_update', { messageId: message.id, status: 'delivered' });
      }
    }
    res.status(201).json({ message: populated });
  } catch (error) {
    next(error);
  }
});

router.put('/read/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'Invalid user id.' });
    if (!req.user.privacy.readReceipts) return res.json({ updated: 0 });
    const result = await Message.updateMany(
      { sender: userId, receiver: req.user.id, status: { $ne: 'read' } },
      { $set: { status: 'read' } },
    );
    req.app.get('io').to(`user:${userId}`).emit('message_status_update', { from: req.user.id, status: 'read' });
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid message id.' });
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found.' });
    if (message.group) {
      if (!await Group.exists({ _id: message.group, members: req.user.id })) {
        return res.status(404).json({ error: 'Message not found.' });
      }
    } else if (!message.sender.equals(req.user.id) && !message.receiver?.equals(req.user.id)) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    const forEveryone = req.query.forEveryone === 'true';
    if (forEveryone) {
      if (!message.sender.equals(req.user.id) || Date.now() - message.createdAt.getTime() > 60 * 60 * 1000) {
        return res.status(403).json({ error: 'You can only delete your own messages for everyone within one hour.' });
      }
      message.content = '';
      message.fileURL = '';
      message.type = 'text';
      message.deletedFor = [];
    } else if (!message.deletedFor.some((id) => id.equals(req.user.id))) {
      message.deletedFor.push(req.user.id);
    }
    await message.save();
    if (forEveryone) {
      const io = req.app.get('io');
      const targets = message.group
        ? (await Group.findById(message.group).select('members'))?.members.map((id) => `user:${id}`) || []
        : [`user:${message.sender}`, `user:${message.receiver}`];
      for (const room of targets) io.to(room).emit('message_deleted', { messageId: message.id, forEveryone: true });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
