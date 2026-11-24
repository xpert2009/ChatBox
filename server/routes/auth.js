import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { getFirebaseAuth } from '../config/firebase.js';
import { User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function makeUsername(name) {
  const base = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18) || 'friend';
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

router.post('/google', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    if (typeof idToken !== 'string' || !idToken) {
      return res.status(400).json({ error: 'A Firebase ID token is required.' });
    }
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    if (!decoded.email || !decoded.name) {
      return res.status(401).json({ error: 'Google account did not provide a name and email.' });
    }
    let user = await User.findOne({ googleId: decoded.uid });
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      let username = makeUsername(decoded.name);
      while (await User.exists({ username })) username = makeUsername(decoded.name);
      user = await User.create({
        googleId: decoded.uid,
        name: decoded.name,
        email: decoded.email,
        photoURL: decoded.picture || '',
        username,
      });
    } else {
      user.name = decoded.name;
      user.email = decoded.email;
      user.photoURL = decoded.picture || user.photoURL;
      await user.save();
    }
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      isNewUser,
      needsUsername: isNewUser,
      user: user.toObject(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    req.user.isOnline = false;
    req.user.lastSeen = new Date();
    await req.user.save();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/username', requireAuth, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').toLowerCase().trim();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Use 3–20 letters, numbers, or underscores.' });
    }
    const taken = await User.exists({ username, _id: { $ne: req.user.id } });
    if (taken) return res.status(409).json({ error: 'That username is already taken.' });
    req.user.username = username;
    await req.user.save();
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
});

export default router;
