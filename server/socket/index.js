import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Message, Notification, Session, User } from '../models/index.js';
import { hasValidSessionClaims } from '../utils/sessions.js';

export function attachSocketServer(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: false,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      if (!hasValidSessionClaims(payload)) return next(new Error('Unauthorized'));
      const session = await Session.findOne({
        _id: payload.sid,
        user: payload.sub,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).select('_id');
      if (!session) return next(new Error('Unauthorized'));
      socket.data.sessionId = session.id;
      socket.data.userId = String(payload.sub);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  const userMessageCount = new Map();

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    const room = `user:${userId}`;
    socket.join(room);
    socket.join(`session:${socket.data.sessionId}`);
    socket.on('send_message', () => {
      const now = Date.now();
      let state = userMessageCount.get(userId);
      if (!state || now > state.resetAt) {
        state = { count: 0, resetAt: now + 60 * 1000 };
      }
      state.count++;
      userMessageCount.set(userId, state);
      if (state.count > 30) {
        socket.emit('error', { message: 'Too many messages. Please slow down.' });
        return;
      }
      socket.emit('error', { message: 'Use the authenticated message API to send messages.' });
    });
    socket.use(async (_packet, next) => {
      try {
        const session = await Session.exists({
          _id: socket.data.sessionId,
          user: userId,
          revokedAt: null,
          expiresAt: { $gt: new Date() },
        });
        if (!session) {
          socket.disconnect(true);
          return next(new Error('Unauthorized'));
        }
        next();
      } catch {
        console.error('Socket session validation failed.');
        socket.disconnect(true);
        next(new Error('Unauthorized'));
      }
    });
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      await Session.findByIdAndUpdate(socket.data.sessionId, { lastSeenAt: new Date() });
      const unreadNotifications = await Notification.countDocuments({ recipient: userId, readAt: null });
      await Notification.updateMany(
        { recipient: userId, deliveredAt: null },
        { $set: { deliveredAt: new Date() } },
      );
      const pendingSenders = await Message.distinct('sender', { receiver: userId, status: 'sent' });
      await Message.updateMany(
        { receiver: userId, status: 'sent' },
        { $set: { status: 'delivered' } },
      );
      for (const senderId of pendingSenders) {
        io.to(`user:${senderId}`).emit('message_status_update', { from: userId, status: 'delivered' });
      }
      socket.emit('pending_notifications', { count: unreadNotifications });
      socket.broadcast.emit('user_online', userId);
    } catch (error) {
      console.error('Presence update failed:', error.message);
    }

    async function canContact(peerId) {
      if (!mongoose.isValidObjectId(peerId) || peerId === userId) return false;
      const [caller, receiver] = await Promise.all([
        User.findById(userId).select('blockedUsers'),
        User.findById(peerId).select('blockedUsers'),
      ]);
      return Boolean(caller && receiver &&
        !caller.blockedUsers.some((id) => id.equals(peerId)) &&
        !receiver.blockedUsers.some((id) => id.equals(userId)));
    }

    socket.on('typing', async ({ to, isTyping } = {}) => {
      try {
        if (await canContact(to)) io.to(`user:${to}`).emit('typing_indicator', { from: userId, isTyping: Boolean(isTyping) });
      } catch (error) {
        console.error('Typing event failed:', error.message);
      }
    });

    socket.on('disconnect', async () => {
      try {
        const sockets = await io.in(room).fetchSockets();
        if (sockets.length) return;
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        io.emit('user_offline', { userId, lastSeen: new Date() });
      } catch (error) {
        console.error('Presence update failed:', error.message);
      }
    });
  });
  return io;
}
