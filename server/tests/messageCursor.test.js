import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import {
  decodeMessageCursor,
  encodeMessageCursor,
  getBeforeFilter,
  getMessagePageSize,
} from '../utils/messageCursor.js';

test('message cursors round-trip their timestamp and ObjectId', () => {
  const message = {
    _id: new mongoose.Types.ObjectId(),
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
  };

  assert.deepEqual(decodeMessageCursor(encodeMessageCursor(message)), {
    id: message._id,
    createdAt: message.createdAt,
  });
});

test('message cursors reject malformed values', () => {
  assert.throws(() => decodeMessageCursor('not-a-cursor'), /Invalid message cursor/);
  assert.throws(() => decodeMessageCursor(Buffer.from('{"id":"bad"}').toString('base64')), /Invalid message cursor/);
});

test('message page size defaults and is capped at 100', () => {
  assert.equal(getMessagePageSize(undefined), 100);
  assert.equal(getMessagePageSize('20'), 20);
  assert.equal(getMessagePageSize('500'), 100);
  assert.equal(getMessagePageSize('-1'), 100);
});

test('before filters order messages by timestamp and id', () => {
  const cursor = { id: new mongoose.Types.ObjectId(), createdAt: new Date('2026-01-02T03:04:05.000Z') };

  assert.deepEqual(getBeforeFilter(cursor), {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  });
});
