import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Session, User } from '../models/index.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.sid) {
      if (!mongoose.isValidObjectId(payload.sid)) {
        return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
      }
      const session = await Session.findOne({
        _id: payload.sid,
        user: payload.sub,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (!session) return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
      req.session = session;
    } else {
      req.session = null;
    }
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    req.user = user;
    req.authToken = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    }
    next(error);
  }
}
