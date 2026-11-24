import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/index.js';

export function attachSocketServer(httpServer, allowedOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? [...new Set([allowedOrigin, 'https://chatbox-frontend.vercel.app'].filter(Boolean))]
        : [...new Set([allowedOrigin, 'http://localhost:5173', 'http://localhost:4173'])],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const payload = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  const activeCalls = new Map();

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    const room = `user:${userId}`;
    socket.join(room);
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
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

    socket.on('call_offer', async ({ to, offer, type } = {}) => {
      try {
        if (!offer || !['voice', 'video'].includes(type) || activeCalls.has(userId) || activeCalls.has(to)) return;
        if (!await canContact(to)) return;
        activeCalls.set(userId, to);
        activeCalls.set(to, userId);
        io.to(`user:${to}`).emit('incoming_call', { from: userId, offer, type });
      } catch (error) {
        console.error('Call offer failed:', error.message);
      }
    });
    socket.on('call_answer', ({ to, answer } = {}) => {
      if (activeCalls.get(userId) === to && answer) io.to(`user:${to}`).emit('call_answered', { from: userId, answer });
    });
    socket.on('ice_candidate', ({ to, candidate } = {}) => {
      if (activeCalls.get(userId) === to && candidate) io.to(`user:${to}`).emit('ice_candidate', { from: userId, candidate });
    });
    socket.on('call_declined', ({ to } = {}) => {
      if (activeCalls.get(userId) === to) {
        activeCalls.delete(userId);
        activeCalls.delete(to);
        io.to(`user:${to}`).emit('call_declined', { from: userId });
      }
    });
    socket.on('call_ended', ({ to } = {}) => {
      if (activeCalls.get(userId) === to) {
        activeCalls.delete(userId);
        activeCalls.delete(to);
        io.to(`user:${to}`).emit('call_ended', { from: userId });
      }
    });

    socket.on('disconnect', async () => {
      try {
        const sockets = await io.in(room).fetchSockets();
        if (sockets.length) return;
        const peerId = activeCalls.get(userId);
        if (peerId) {
          activeCalls.delete(userId);
          activeCalls.delete(peerId);
          io.to(`user:${peerId}`).emit('call_ended', { from: userId });
        }
        await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        io.emit('user_offline', { userId, lastSeen: new Date() });
      } catch (error) {
        console.error('Presence update failed:', error.message);
      }
    });
  });
  return io;
}
