import { Router } from 'express';
import { z } from 'zod';
import { authChecker } from './middleware';
import { type User } from '@models/user-schema';
import { models } from '@models/index';

const router = Router();

const UserModel = models.User;

const ZUserSchema = z.object({
  _id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
});

router.get(('/myself'), (req, res, next) => {
  if (req.guser === undefined) {
    res.sendStatus(400);
    return;
  }
  req.url = `/${req.guser.uid}`;
  next();
});

router.get('/:uid', authChecker, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const guser = req.guser!;
    const targetUser = await UserModel.findOne({ _id: guser.uid }).exec();
    if (targetUser === null) {
      // If not found, return status 404
      // In this case, expect recourse be created by PUT soon after
      res.sendStatus(404);
    } else {
      res.json(targetUser.toJSON());
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

router.put('/:uid', authChecker, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const guser = req.guser!;
    const result = ZUserSchema.partial().safeParse(req.body);
    if (!result.success) {
      console.log(result.error);
      res.sendStatus(400);
      return;
    }
    const newInfo = result.data as Partial<User>;
    let targetUser = await UserModel.findOne({ _id: guser.uid }).exec();
    if (targetUser !== null) {
      targetUser.set(newInfo); // properties not in User will not be store into document
      await targetUser.save();
      res.sendStatus(204);
    } else {
      // If the target user does currently not exist, create it
      targetUser = new UserModel({
        _id: guser.uid,
        name: guser.name as string,
        email: guser.email,
      });
      targetUser.set(newInfo);
      await targetUser.save();
      res.sendStatus(201);
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

export default router;
