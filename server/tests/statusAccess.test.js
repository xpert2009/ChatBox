import assert from 'node:assert/strict';
import test from 'node:test';
import { canViewStatus } from '../utils/statusAccess.js';

test('status owners can view their own active status', () => {
  assert.equal(canViewStatus({
    ownerId: 'owner-id',
    viewerId: 'owner-id',
    viewerBlockedUsers: [],
    ownerBlockedUsers: [],
    isContact: false,
  }), true);
});

test('non-contacts cannot view another user status', () => {
  assert.equal(canViewStatus({
    ownerId: 'owner-id',
    viewerId: 'viewer-id',
    viewerBlockedUsers: [],
    ownerBlockedUsers: [],
    isContact: false,
  }), false);
});

test('contacts can view a status unless either user has blocked the other', () => {
  const allowed = {
    ownerId: 'owner-id',
    viewerId: 'viewer-id',
    viewerBlockedUsers: [],
    ownerBlockedUsers: [],
    isContact: true,
  };
  assert.equal(canViewStatus(allowed), true);
  assert.equal(canViewStatus({ ...allowed, viewerBlockedUsers: ['owner-id'] }), false);
  assert.equal(canViewStatus({ ...allowed, ownerBlockedUsers: ['viewer-id'] }), false);
});
