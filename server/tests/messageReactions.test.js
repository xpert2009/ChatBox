import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Message, Session, User } from '../models/index.js';
import messageRoutes from '../routes/messages.js';
import { toggleMessageReaction } from '../utils/messageReactions.js';

test('both reaction URL forms reach the authenticated reaction handler', async (t) => {
  const originalSecret = process.env.JWT_SECRET;
  const originalSessionFindOne = Session.findOne;
  const originalUserFindById = User.findById;
  const originalMessageFindById = Message.findById;
  const userId = '507f1f77bcf86cd799439011';
  const sessionId = '507f191e810c19729de860ea';
  const messageId = '507f1f77bcf86cd799439012';
  process.env.JWT_SECRET = 'reaction-route-test-secret-0123456789';

  const message = {
    id: messageId,
    group: null,
    sender: new mongoose.Types.ObjectId(userId),
    receiver: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
    reactions: [],
    async save() {},
  };
  Session.findOne = async () => ({ id: sessionId });
  User.findById = async () => ({ id: userId, blockedUsers: [] });
  Message.findById = async () => message;
  t.after(() => {
    Session.findOne = originalSessionFindOne;
    User.findById = originalUserFindById;
    Message.findById = originalMessageFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/messages', messageRoutes);
  app.set('io', { to: () => ({ emit() {} }) });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const token = jwt.sign({ sub: userId, sid: sessionId }, process.env.JWT_SECRET);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/messages/${messageId}`;
  const reactionResponse = await fetch(`${baseUrl}/reaction`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji: '👍' }),
  });
  assert.equal(reactionResponse.status, 200);
  assert.deepEqual((await reactionResponse.json()).reactions, [{ userId, emoji: '👍' }]);

  const legacyResponse = await fetch(baseUrl, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction: '❤️' }),
  });
  assert.equal(legacyResponse.status, 200);
  assert.deepEqual((await legacyResponse.json()).reactions, [{ userId, emoji: '❤️' }]);
});

test('a user can add a reaction without removing other users reactions', () => {
  const current = [{ userId: 'user-a', emoji: '❤️' }];
  const updated = toggleMessageReaction(current, 'user-b', '👍');

  assert.deepEqual(updated, [
    { userId: 'user-a', emoji: '❤️' },
    { userId: 'user-b', emoji: '👍' },
  ]);
});

test('a user can switch or remove their reaction', () => {
  const current = [{ userId: 'user-a', emoji: '❤️' }, { userId: 'user-b', emoji: '👍' }];
  const switched = toggleMessageReaction(current, 'user-a', '😂');

  assert.deepEqual(switched, [
    { userId: 'user-a', emoji: '😂' },
    { userId: 'user-b', emoji: '👍' },
  ]);
  assert.deepEqual(toggleMessageReaction(switched, 'user-a', '😂'), [
    { userId: 'user-b', emoji: '👍' },
  ]);
});

test('reactions with populated user references are normalized safely', () => {
  const updated = toggleMessageReaction(
    [{ userId: { _id: 'user-a' }, emoji: '❤️' }],
    'user-a',
    '👍',
  );

  assert.deepEqual(updated, [{ userId: 'user-a', emoji: '👍' }]);
});
