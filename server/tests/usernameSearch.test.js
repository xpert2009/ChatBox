import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createUsernameBaseFromEmail, User } from '../models/index.js';
import userRoutes, {
  createUsernameSearchResult,
  createUserSearchLimiter,
  normalizeUsernameSearch,
} from '../routes/users.js';

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test('username generation base is derived from the email local part', () => {
  assert.equal(createUsernameBaseFromEmail('John.Doe@gmail.com'), 'johndoe');
  assert.equal(createUsernameBaseFromEmail('ab@gmail.com'), 'userab');
});

test('missing usernames are generated from email before required validation', async (t) => {
  const originalExists = User.exists;
  User.exists = async ({ username }) => username === 'johndoe';
  t.after(() => { User.exists = originalExists; });

  const user = new User({
    googleId: 'google-user',
    name: 'John Doe',
    email: 'John.Doe@gmail.com',
  });
  await user.validate();
  assert.match(user.username, /^johndoe\d{4}$/);
});

test('username search normalizes @ prefixes and rejects malformed or short input', () => {
  assert.equal(normalizeUsernameSearch(' @John_123 '), 'john_123');
  assert.equal(normalizeUsernameSearch('john_123'), 'john_123');
  assert.equal(normalizeUsernameSearch('jo'), null);
  assert.equal(normalizeUsernameSearch('john*'), null);
});

test('username search results contain only public, privacy-filtered fields', () => {
  const result = createUsernameSearchResult({
    toObject: () => ({
      _id: 'public-user-id',
      name: 'ChatBox User',
      username: 'chatbox123',
      photoURL: 'https://example.test/avatar.png',
      isOnline: true,
      email: 'private@example.test',
      privacy: { photo: 'nobody', online: 'nobody' },
    }),
  }, false);

  assert.deepEqual(result, {
    _id: 'public-user-id',
    displayName: 'ChatBox User',
    username: 'chatbox123',
    photoURL: '',
    online: false,
  });
});

test('user search route requires authentication', async () => {
  const app = express();
  app.use('/api/users', userRoutes);

  await withServer(app, async (url) => {
    const response = await fetch(`${url}/api/users/search?q=someone`);
    assert.equal(response.status, 401);
  });
});

test('username search limiter allows ten requests per user per minute', async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: req.get('x-user-id') };
    next();
  });
  app.get('/search', createUserSearchLimiter(), (_req, res) => res.sendStatus(200));

  await withServer(app, async (url) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${url}/search`, { headers: { 'x-user-id': 'first-user' } });
      assert.equal(response.status, 200);
    }

    const limitedResponse = await fetch(`${url}/search`, { headers: { 'x-user-id': 'first-user' } });
    const otherUserResponse = await fetch(`${url}/search`, { headers: { 'x-user-id': 'second-user' } });
    assert.equal(limitedResponse.status, 429);
    assert.equal(otherUserResponse.status, 200);
  });
});
