import { Router } from 'express';
import mongoose from 'mongoose';
import { Group, User } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeVisibleUser } from '../utils/privacy.js';

const router = Router();
router.use(requireAuth);

function isAdmin(group, userId) {
  return group.admins.some((id) => id.equals(userId));
}

function emitGroupUpdate(req, group, additionalUserIds = []) {
  const userIds = new Set([...group.members.map(String), ...additionalUserIds.map(String)]);
  for (const userId of userIds) req.app.get('io').to(`user:${userId}`).emit('groups_updated');
}

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const memberIds = [...new Set([req.user.id, ...(req.body.members || []).map(String)])];
    if (!name || name.length > 80 || memberIds.length < 2 || memberIds.length > 256) {
      return res.status(400).json({ error: 'Provide a group name and at least one other member.' });
    }
    const members = await User.find({ _id: { $in: memberIds } }).select('_id');
    if (members.length !== memberIds.length) return res.status(400).json({ error: 'One or more members do not exist.' });
    const group = await Group.create({
      name,
      description: String(req.body.description || '').slice(0, 250),
      photoURL: String(req.body.photoURL || ''),
      members: memberIds,
      admins: [req.user.id],
      createdBy: req.user.id,
    });
    emitGroupUpdate(req, group);
    res.status(201).json({ group });
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.user.id }).sort({ updatedAt: -1 }).populate('members', 'name username photoURL isOnline privacy');
    res.json({ groups: groups.map((group) => {
      const visibleGroup = group.toObject();
      visibleGroup.members = group.members.map((member) => serializeVisibleUser(member, true));
      return visibleGroup;
    }) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, members: req.user.id })
      .populate('members', 'name username photoURL isOnline privacy')
      .populate('admins', 'name username');
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    const visibleGroup = group.toObject();
    visibleGroup.members = group.members.map((member) => serializeVisibleUser(member, true));
    res.json({ group: visibleGroup });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, members: req.user.id });
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (!isAdmin(group, req.user.id)) return res.status(403).json({ error: 'Only admins can edit this group.' });
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name || name.length > 80) return res.status(400).json({ error: 'Group name must be 1–80 characters.' });
      group.name = name;
    }
    if (req.body.description !== undefined) group.description = String(req.body.description).slice(0, 250);
    if (req.body.photoURL !== undefined) group.photoURL = String(req.body.photoURL);
    if (req.body.onlyAdminCanMessage !== undefined) group.onlyAdminCanMessage = Boolean(req.body.onlyAdminCanMessage);
    await group.save();
    emitGroupUpdate(req, group);
    res.json({ group });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/members', async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, members: req.user.id });
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (!isAdmin(group, req.user.id)) return res.status(403).json({ error: 'Only admins can add members.' });
    const users = [...new Set((req.body.users || []).map(String))];
    if (!users.length || users.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ error: 'Select at least one valid user.' });
    }
    const existing = await User.find({ _id: { $in: users } }).select('_id');
    if (existing.length !== users.length) return res.status(400).json({ error: 'One or more users do not exist.' });
    group.members.addToSet(...users);
    await group.save();
    emitGroupUpdate(req, group);
    res.json({ group });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, members: req.user.id });
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    if (!isAdmin(group, req.user.id)) return res.status(403).json({ error: 'Only admins can remove members.' });
    const removedUserId = req.params.userId;
    group.members.pull(req.params.userId);
    group.admins.pull(req.params.userId);
    await group.save();
    emitGroupUpdate(req, group, [removedUserId]);
    res.json({ group });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/leave', async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, members: req.user.id });
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    group.members.pull(req.user.id);
    group.admins.pull(req.user.id);
    await group.save();
    emitGroupUpdate(req, group, [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
