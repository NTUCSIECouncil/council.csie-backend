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
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  if (req.rawToken !== undefined) {
    res.cookie('token', req.rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000,
    });
  }
  req.url = req.url.replace(/^\/me/, `/${req.userId}`);
  next();
});

router.post('/', async (req, res) => {
  if (req.decodedToken === undefined) {
    logger.warn('Unauthorized access to POST /users');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  const { uid: gid } = req.decodedToken;

  let userCreate;
  try {
    userCreate = z.object({ nickname: z.string().max(30) }).parse(req.body);
  } catch (err) {
    logger.warn('Failed to parse request body in POST /users: ', err);
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  const existingUser = await UserModel.findOne({ gid }).exec();
  if (existingUser) {
    logger.warn(`User already exists with gid ${gid}`);
    res.status(409).json({ message: 'User already exists' });
    return;
  }

  // The signup profile comes from the just-minted ID token's claims (Google
  // sign-in populates `name`/`email`), so no getUser round-trip is needed. The
  // `name` claim lives on DecodedIdToken's index signature, so pull it out via
  // Zod to keep it typed rather than reaching through `any`.
  const { name, email } = z
    .object({ name: z.string(), email: z.string() })
    .partial()
    .parse(req.decodedToken);
  if (name === undefined || email === undefined) {
    logger.warn(`Missing user information for gid ${gid}`);
    res.status(500).json({ message: 'Missing user information' });
    return;
  }

  const userData = { gid, name, email, nickname: userCreate.nickname };

  const userDoc = new UserModel(userData);
  await userDoc.save();
  const userId = userDoc._id;
  if (req.rawToken !== undefined) {
    res.cookie('token', req.rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000,
    });
  }
  res.status(201).json({ userId });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
  });
  res.sendStatus(204);
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
  const userResponse = { _id: user._id, nickname: user.nickname };
  res.json({ user: userResponse });
});

router.patch('/:userId', async (req, res) => {
  if (req.userId === undefined) {
    logger.warn('Unauthorized access to PATCH /users/:userId');
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  let userId: UUID;
  let userUpdates;
  try {
    userId = ZUuidSchema.parse(req.params.userId);
    userUpdates = z
      .object({ nickname: z.string().max(30) })
      .partial()
      .parse(req.body);
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
    res.status(401).json({ message: 'Unauthorized' });
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
