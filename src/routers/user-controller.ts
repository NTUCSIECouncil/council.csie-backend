import { Router } from 'express';
import { z } from 'zod';
import { ZUuidSchema } from '@/models/util-schema.ts';
import { models } from '@models/index.ts';
import { authChecker } from './middleware.ts';

const router = Router();

const UserModel = models.User;

router.all('/me{/*splat}', (req, res, next) => {
  if (req.guser === undefined) {
    res.sendStatus(400);
    return;
  }
  req.url = req.url.replace(/^\/me/, `/${req.guser.uid}`);
  next();
});

router.get('/:userId', async (req, res) => {
  let userId;
  try {
    userId = ZUuidSchema.parse(req.params.userId);
  } catch (err) {
    console.warn('Failed to parse userId in GET /users/:userId: ', err);
    res.sendStatus(400);
    return;
  }
  const user = await UserModel.findById(userId).exec();
  if (user === null) {
    res.sendStatus(404);
  } else {
    res.json({ user: { _id: user._id, nickname: user.nickname } });
  }
});

router.put('/:userId', authChecker, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const guser = req.guser!;

  let nickname;
  try {
    nickname = z.object({ nickname: z.string() }).parse(req.body).nickname;
  } catch (err) {
    console.warn('Failed to parse request body in PUT /users/:userId: ', err);
    res.sendStatus(400);
    return;
  }

  let userDoc = await UserModel.findOne({ gid: guser.uid }).exec();
  if (userDoc !== null) {
    userDoc.nickname = nickname;
    await userDoc.save();
    res.sendStatus(204);
  } else {
    const user = { gid: guser.uid, name: guser.displayName, email: guser.email, nickname };
    userDoc = new UserModel(user);
    await userDoc.save();
    res.status(201).json({ userId: guser.uid });
  }
});

router.get('/:userId/private', authChecker, async (req, res) => {
  const user = await UserModel.findById({ _id: req.params.userId }).exec();
  if (user === null) {
    res.sendStatus(404);
  } else {
    res.json({ user });
  }
});

export default router;
