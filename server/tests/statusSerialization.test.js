import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeStatus } from '../utils/statusSerialization.js';

test('status serialization returns a view count without exposing viewer ids', () => {
  const status = {
    viewers: ['viewer-one', 'viewer-two'],
    toObject() {
      return { _id: 'status-id', viewers: this.viewers };
    },
  };

  const serialized = serializeStatus(status);

  assert.equal(serialized.viewerCount, 2);
  assert.equal(Object.hasOwn(serialized, 'viewers'), false);
});
