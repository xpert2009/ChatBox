import mongoose from 'mongoose';

export function decodeMessageCursor(value) {
  if (!value) return null;

  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
    const createdAt = new Date(cursor.createdAt);
    if (!mongoose.isValidObjectId(cursor.id) || Number.isNaN(createdAt.getTime())) {
      throw new Error('Invalid message cursor.');
    }
    return { id: new mongoose.Types.ObjectId(cursor.id), createdAt };
  } catch {
    throw new Error('Invalid message cursor.');
  }
}

export function encodeMessageCursor(message) {
  return Buffer.from(JSON.stringify({
    id: String(message._id),
    createdAt: new Date(message.createdAt).toISOString(),
  })).toString('base64');
}

export function getMessagePageSize(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 100;
}

export function getBeforeFilter(cursor) {
  if (!cursor) return null;
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
}
