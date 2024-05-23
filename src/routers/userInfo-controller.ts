import { Router } from 'express';
import { type User } from '@models/UserSchema';
import { models } from '@models/index';
import { authChecker } from './middleware';

const router = Router();

const UserModel = models.User;

router.get(['/:uid', '/myself'], authChecker, (req, res, next) => {
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
  })().catch((err) => {
    next(err);
  });
});

router.put('/:uid', authChecker, (req, res, next) => {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
    const guser = req.guser!;
    const newInfo: Partial<User> = req.body;
    let targetUser = await UserModel.findOne({ _id: guser.uid }).exec();
    if (targetUser !== null) {
      targetUser.set(newInfo); // properties not in User will not be store into document
      await targetUser.save();
      res.sendStatus(204);
    } else {
      // If the target user does currently not exist, create it
      targetUser = new UserModel({
        _id: guser.uid,
        name: guser.name,
        email: guser.email
      });
      targetUser.set(newInfo);
      await targetUser.save();
      res.sendStatus(201);
    }
  })().catch((err) => {
    next(err);
  });
});

export default router;
