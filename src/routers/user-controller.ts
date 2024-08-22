import { Router } from 'express';
import { models } from '@models/index.ts';
import { type User, ZUserSchema } from '@models/user-schema.ts';
import { authChecker } from './middleware.ts';

const router = Router();

const UserModel = models.User;

router.get(('/myself'), (req, res, next) => {
  if (req.guser === undefined) {
    res.sendStatus(400);
    return;
  }
  req.url = `/${req.guser.uid}`;
  next();
});

router.get('/:uuid', authChecker, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const guser = req.guser!;
    const target = await UserModel.findOne({ _id: guser.uid }).exec();
    if (target === null) {
      // If not found, return status 404
      // In this case, expect recourse be created by PUT soon after
      res.sendStatus(404);
    } else {
      res.send({ item: target });
    }
  })().catch((err: unknown) => {
    next(err);
  });
});

router.patch('/:uuid', authChecker, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const guser = req.guser!;
    let newInfo: Partial<User>;
    try {
      newInfo = ZUserSchema.partial().parse(req.body);
    } catch (err: unknown) {
      console.log(err);
      res.sendStatus(400);
      return;
    }

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
