import { type UUID } from 'crypto';

import { Router } from 'express';
import { z } from 'zod';

import { ZUuidSchema } from '@/models/util-schema.ts';
import { models } from '@models/index.ts';
import logger from '@utils/logger.ts';

const router = Router();

const UserModel = models.User;

router.all('/me{/*splat}', (req, res, next) => {
  if (req.userId === undefined) {
    logger.warn('Unauthorized access to /me route - no authenticated user');
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  req.url = req.url.replace(/^\/me/, `/${req.userId}`);
  next();
});

router.post('/', async (req, res) => {
  if (req.guser === undefined) {
    logger.warn('Unauthorized access to POST /users');
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  let userCreate;
  try {
    userCreate = z.object({ nickname: z.string() }).parse(req.body);
  } catch (err) {
    logger.warn('Failed to parse request body in POST /users: ', err);
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  const existingUser = await UserModel.findOne({ gid: req.guser.uid }).exec();
  if (existingUser) {
    logger.warn(`User already exists with gid ${req.guser.uid}`);
    res.status(409).json({ message: 'User already exists' });
    return;
  }

  if (req.guser.displayName === undefined || req.guser.email === undefined) {
    logger.warn(`Missing user information for gid ${req.guser.uid}`);
    logger.warn('User information:', req.guser);
    res.status(500).json({ message: 'Missing user information' });
    return;
  }

  const userData = {
    gid: req.guser.uid,
    name: req.guser.displayName,
    email: req.guser.email,
    nickname: userCreate.nickname,
  };

  const userDoc = new UserModel(userData);
  await userDoc.save();
  const userId = userDoc._id;
  res.status(201).json({ userId });
});

router.get('/:userId', async (req, res) => {
  let userId;
  try {
    userId = ZUuidSchema.parse(req.params.userId);
  } catch (err) {
    logger.warn('Failed to parse userId in GET /users/:userId: ', err);
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  const user = await UserModel.findById(userId)
    .lean({ versionKey: false })
    .exec();
  if (user === null) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  // Return only public user information
  const userResponse = {
    _id: user._id,
    nickname: user.nickname,
  };
  res.json({ user: userResponse });
});

router.patch('/:userId', async (req, res) => {
  if (req.userId === undefined) {
    logger.warn('Unauthorized access to PATCH /users/:userId');
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  let userId: UUID;
  let userUpdates;
  try {
    userId = ZUuidSchema.parse(req.params.userId);
    userUpdates = z.object({ nickname: z.string() }).partial().parse(req.body);
  } catch (err) {
    logger.warn(
      'Failed to parse userId or request body in PATCH /users/:userId: ',
      err,
    );
    res.status(400).json({ message: 'Invalid request' });
    return;
  }

  const userDoc = await UserModel.findById(userId).exec();
  if (userDoc === null) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (userId !== req.userId) {
    logger.warn(
      `Forbidden access to PATCH /users/${userId} by user ${req.userId}`,
    );
    res.status(403).json({ message: 'Forbidden' });
    return;
  }

  userDoc.set(userUpdates);
  await userDoc.save();

  res.sendStatus(204);
});

router.get('/:userId/private', async (req, res) => {
  if (req.userId === undefined) {
    logger.warn('Unauthorized access to GET /users/:userId/private');
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  let userId;
  try {
    userId = ZUuidSchema.parse(req.params.userId);
  } catch (err) {
    logger.warn('Failed to parse userId in GET /users/:userId/private: ', err);
    res.status(400).json({ message: 'Invalid user ID' });
    return;
  }

  const user = await UserModel.findById(userId)
    .lean({ versionKey: false })
    .exec();
  if (user === null) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  if (userId !== req.userId) {
    logger.warn(
      `Forbidden access to GET /users/${userId}/private by user ${req.userId}`,
    );
    res.status(403).json({ message: 'Forbidden' });
    return;
  }

  res.json({ user });
});

export default router;
