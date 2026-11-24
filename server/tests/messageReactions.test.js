import assert from 'node:assert/strict';
import test from 'node:test';
import { toggleMessageReaction } from '../utils/messageReactions.js';

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
