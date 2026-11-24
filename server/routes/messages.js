import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Group, GroupMessage, Media, Message, Notification, User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeVisibleUser } from '../utils/privacy.js';
import {
  decodeMessageCursor,
  encodeMessageCursor,
  getBeforeFilter,
  getMessagePageSize,
} from '../utils/messageCursor.js';

const router = Router();
router.use(requireAuth);

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Sending too fast. Please slow down.' },
  keyGenerator: (req) => req.user?.id
    ? `user:${req.user.id}`
    : `ip:${ipKeyGenerator(req.ip)}`,
});
router.use(messageLimiter);

function messageFilterWithCursor(filter, cursor) {
  const before = getBeforeFilter(cursor);
  return before ? { $and: [filter, before] } : filter;
}

function compareNewest(first, second) {
  const timeDifference = new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
  return timeDifference || String(second._id).localeCompare(String(first._id));
}

router.get('/conversations', async (req, res, next) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);
    const [latest, unreadMessages] = await Promise.all([
      Message.aggregate([
        {
          $match: {
            group: null,
            $or: [{ sender: userObjectId }, { receiver: userObjectId }],
          },
        },
        {
          $addFields: {
            peerId: { $cond: [{ $eq: ['$sender', userObjectId] }, '$receiver', '$sender'] },
          },
        },
        { $match: { peerId: { $ne: null } } },
        { $sort: { createdAt: -1, _id: -1 } },
        {
          $group: {
            _id: '$peerId',
            lastMessage: { $first: '$$ROOT' },
          },
        },
        { $sort: { 'lastMessage.createdAt': -1, 'lastMessage._id': -1 } },
      ]),
      Message.aggregate([
        {
          $match: {
            group: null,
            receiver: userObjectId,
            $expr: {
              $eq: [
                { $in: [userObjectId, { $ifNull: ['$readBy', []] }] },
                false,
              ],
            },
          },
        },
        { $group: { _id: '$sender', unread: { $sum: 1 } } },
      ]),
    ]);
    const unreadByPeer = new Map();
    for (const entry of unreadMessages) {
      const peerId = String(entry._id);
      unreadByPeer.set(peerId, (unreadByPeer.get(peerId) || 0) + entry.unread);
    }
    const peerIds = latest.map((entry) => entry._id);
    const messageIds = latest.map((entry) => entry.lastMessage._id);
    const [users, messages] = await Promise.all([
      User.find({ _id: { $in: peerIds } }).select('name username photoURL isOnline lastSeen privacy'),
      Message.find({ _id: { $in: messageIds } })
        .populate('sender', 'name username photoURL isOnline lastSeen privacy')
        .populate('receiver', 'name username photoURL isOnline lastSeen privacy'),
    ]);
    const usersById = new Map(users.map((peer) => [peer.id, peer]));
    const messagesById = new Map(messages.map((message) => [message.id, message]));
    const conversations = latest.flatMap((entry) => {
      const peer = usersById.get(String(entry._id));
      const message = messagesById.get(String(entry.lastMessage._id));
      if (!peer || !message) return [];
      const lastMessage = message.toObject();
      lastMessage.sender = serializeVisibleUser(message.sender, true);
      lastMessage.receiver = message.receiver ? serializeVisibleUser(message.receiver, true) : null;
      return [{
        user: serializeVisibleUser(peer, true),
        lastMessage,
        unread: unreadByPeer.get(peer.id) || 0,
      }];
    });
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { userId, groupId, before } = req.query;
    const limit = getMessagePageSize(req.query.limit);
    const cursor = decodeMessageCursor(before);
    let messages;

    if (groupId && mongoose.isValidObjectId(groupId)) {
      const group = await Group.findOne({ _id: groupId, members: req.user.id });
      if (!group) return res.status(404).json({ error: 'Group not found.' });
      const baseFilter = { group: groupId };
      const filter = messageFilterWithCursor(baseFilter, cursor);
      const [legacyMessages, groupMessages] = await Promise.all([
        Message.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit + 1)
          .populate('sender', 'name username photoURL privacy')
          .populate('replyTo', 'content sender type'),
        GroupMessage.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit + 1)
          .populate('sender', 'name username photoURL privacy')
          .populate('replyTo', 'content sender type'),
      ]);
      messages = [...legacyMessages, ...groupMessages].sort(compareNewest).slice(0, limit + 1);
    } else if (userId && mongoose.isValidObjectId(userId)) {
      if (req.user.blockedUsers.some((id) => id.equals(userId))) {
        return res.status(403).json({ error: 'This contact is blocked.' });
      }
      const baseFilter = {
        group: null,
        $or: [
          { sender: req.user.id, receiver: userId },
          { sender: userId, receiver: req.user.id },
        ],
      };
      messages = await Message.find(messageFilterWithCursor(baseFilter, cursor))
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .populate('sender', 'name username photoURL privacy')
        .populate('replyTo', 'content sender type');
    } else {
      return res.status(400).json({ error: 'A valid userId or groupId is required.' });
    }

    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit);
    const nextCursor = hasMore ? encodeMessageCursor(page[page.length - 1]) : null;
    const visibleMessages = page.reverse().map((message) => {
      const result = message.toObject();
      if (result.sender) result.sender = serializeVisibleUser(message.sender, true);
      return result;
    });
    res.json({ messages: visibleMessages, hasMore, nextCursor });
  } catch (error) {
    if (error.message === 'Invalid message cursor.') return res.status(400).json({ error: error.message });
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const {
      to,
      groupId,
      type = 'text',
      content = '',
      fileURL = '',
      fileName = '',
      fileSize = 0,
      mediaId,
      replyTo,
    } = req.body;
    const allowedTypes = ['text', 'image', 'video', 'audio', 'document'];
    if (!allowedTypes.includes(type) || (type === 'text' && !String(content).trim())) {
      return res.status(400).json({ error: 'Message content or type is invalid.' });
    }
    if (typeof fileURL !== 'string' || typeof fileName !== 'string' ||
        !Number.isFinite(Number(fileSize)) || Number(fileSize) < 0) {
      return res.status(400).json({ error: 'Attachment details are invalid.' });
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
      if (!mongoose.isValidObjectId(to)) return res.status(400).json({ error: 'A valid recipient is required.' });
      receiver = await User.findById(to);
      if (!receiver) return res.status(404).json({ error: 'Recipient not found.' });
      if (req.user.blockedUsers.some((id) => id.equals(receiver.id)) ||
          receiver.blockedUsers.some((id) => id.equals(req.user.id))) {
        return res.status(403).json({ error: 'Messages cannot be sent to this contact.' });
      }
    }

    let media = null;
    if (mediaId) {
      if (!mongoose.isValidObjectId(mediaId)) return res.status(400).json({ error: 'Invalid media id.' });
      media = await Media.findOne({ _id: mediaId, owner: req.user.id });
      if (!media || media.secureURL !== fileURL) return res.status(400).json({ error: 'The attachment is not available.' });
    }

    let validReply = null;
    if (replyTo) {
      if (!mongoose.isValidObjectId(replyTo)) return res.status(400).json({ error: 'Invalid reply target.' });
      const replyFilter = group
        ? { _id: replyTo, group: group.id }
        : {
            _id: replyTo,
            group: null,
            $or: [
              { sender: req.user.id, receiver: receiver.id },
              { sender: receiver.id, receiver: req.user.id },
            ],
          };
      validReply = group
        ? (await GroupMessage.exists(replyFilter)) || (await Message.exists(replyFilter))
        : await Message.exists(replyFilter);
      if (!validReply) return res.status(400).json({ error: 'The reply target is not in this conversation.' });
    }

    const io = req.app.get('io');
    const recipients = group
      ? group.members.filter((memberId) => !memberId.equals(req.user.id))
      : [receiver._id];
    const onlineRecipients = new Set(
      recipients
        .filter((recipientId) => (io.sockets.adapter.rooms.get(`user:${recipientId}`)?.size || 0) > 0)
        .map(String),
    );
    const message = group
      ? await GroupMessage.create({
          sender: req.user.id,
          group: group.id,
          type,
          content: String(content).slice(0, 10000),
          fileURL: fileURL.slice(0, 2048),
          fileName: fileName.slice(0, 200),
          fileSize: Number(fileSize),
          media: media?._id || null,
          replyTo: validReply ? replyTo : null,
        })
      : await Message.create({
          sender: req.user.id,
          receiver: receiver.id,
          type,
          content: String(content).slice(0, 10000),
          fileURL: fileURL.slice(0, 2048),
          fileName: fileName.slice(0, 200),
          fileSize: Number(fileSize),
          media: media?._id || null,
          replyTo: validReply ? replyTo : null,
          status: onlineRecipients.has(String(receiver._id)) ? 'delivered' : 'sent',
        });

    if (recipients.length) {
      await Notification.insertMany(recipients.map((recipient) => ({
        recipient,
        actor: req.user.id,
        messageId: message._id,
        group: group?._id || null,
        type: group ? 'group_message' : 'message',
        deliveredAt: onlineRecipients.has(String(recipient)) ? new Date() : null,
      })));
    }

    const populated = await message.populate('sender', 'name username photoURL');
    if (group) {
      for (const memberId of group.members) io.to(`user:${memberId}`).emit('receive_message', populated);
    } else {
      io.to(`user:${receiver.id}`).emit('receive_message', populated);
      io.to(`user:${req.user.id}`).emit('receive_message', populated);
      if (onlineRecipients.has(String(receiver.id))) {
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
    const update = { $addToSet: { readBy: req.user.id } };
    if (req.user.privacy.readReceipts) {
      update.$set = { status: 'read' };
    }
    const result = await Message.updateMany(
      { sender: userId, receiver: req.user.id },
      update,
    );
    if (req.user.privacy.readReceipts) {
      req.app.get('io').to(`user:${userId}`).emit('message_status_update', { from: req.user.id, status: 'read' });
    }
    await Notification.updateMany(
      { recipient: req.user.id, actor: userId, group: null, readAt: null },
      { $set: { readAt: new Date(), deliveredAt: new Date() } },
    );
    req.app.get('io').to(`user:${req.user.id}`).emit('conversations_updated');
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.put('/read/group/:groupId', async (req, res, next) => {
  try {
    const { groupId } = req.params;
    if (!mongoose.isValidObjectId(groupId)) return res.status(400).json({ error: 'Invalid group id.' });
    const group = await Group.exists({ _id: groupId, members: req.user.id });
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    const [legacyMessages, groupMessages, notifications] = await Promise.all([
      Message.updateMany(
        { group: groupId, sender: { $ne: req.user.id } },
        { $addToSet: { readBy: req.user.id } },
      ),
      GroupMessage.updateMany(
        { group: groupId, sender: { $ne: req.user.id } },
        { $addToSet: { readBy: req.user.id } },
      ),
      Notification.updateMany(
        { recipient: req.user.id, group: groupId, readAt: null },
        { $set: { readAt: new Date(), deliveredAt: new Date() } },
      ),
    ]);
    req.app.get('io').to(`user:${req.user.id}`).emit('conversations_updated');
    res.json({ updated: legacyMessages.modifiedCount + groupMessages.modifiedCount + notifications.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (_req, res) => {
  res.status(410).json({ error: 'Messages are retained and cannot be deleted.' });
});

export default router;
