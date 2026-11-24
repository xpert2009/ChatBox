import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Session } from '../models/index.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function hasValidSessionClaims(payload) {
  return Boolean(
    payload &&
    mongoose.isValidObjectId(payload.sub) &&
    mongoose.isValidObjectId(payload.sid),
  );
}

export async function createSessionToken(userId) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await Session.create({ user: userId, expiresAt });
  const token = jwt.sign(
    { sub: String(userId), sid: session.id },
    process.env.JWT_SECRET,
    { expiresIn: '30d' },
  );
  return { token, session };
}
