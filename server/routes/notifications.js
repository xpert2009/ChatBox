import { Router } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
    const filter = { recipient: req.user.id };
    if (req.query.unread !== 'false') filter.readAt = null;
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate('actor', 'name username photoURL');
    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

router.put('/read', async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, readAt: null },
      { $set: { readAt: new Date(), deliveredAt: new Date() } },
    );
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid notification id.' });
    const result = await Notification.updateOne(
      { _id: req.params.id, recipient: req.user.id, readAt: null },
      { $set: { readAt: new Date(), deliveredAt: new Date() } },
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
