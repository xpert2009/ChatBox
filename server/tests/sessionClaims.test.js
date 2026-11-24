import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { hasValidSessionClaims } from '../utils/sessions.js';

const userId = '507f1f77bcf86cd799439011';
const sessionId = '507f191e810c19729de860ea';

test('session tokens require valid user and session ids', () => {
  assert.equal(hasValidSessionClaims({ sub: userId, sid: sessionId }), true);
  assert.equal(hasValidSessionClaims({ sub: userId }), false);
  assert.equal(hasValidSessionClaims({ sub: 'legacy-user', sid: sessionId }), false);
  assert.equal(hasValidSessionClaims({ sub: userId, sid: 'legacy-session' }), false);
});

test('HTTP auth rejects legacy tokens without a session id', async () => {
  const secret = 'test-secret-that-is-long-enough-to-sign';
  process.env.JWT_SECRET = secret;
  const token = jwt.sign({ sub: userId }, secret, { expiresIn: '1m' });
  let statusCode;
  let responseBody;
  let nextCalled = false;
  const req = { get: () => `Bearer ${token}` };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(statusCode, 401);
  assert.match(responseBody.error, /session is no longer valid/i);
  assert.equal(nextCalled, false);
});
