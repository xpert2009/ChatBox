import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import authRoutes from '../routes/auth.js';

test('Google auth returns 400 when the request body is missing', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/google`, {
    method: 'POST',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'A Firebase ID token is required.' });
});
