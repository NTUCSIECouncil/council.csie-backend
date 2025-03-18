import { Router } from 'express';
import { models } from '@models/index.ts';
import { authChecker } from './middleware.ts';

const router = Router();

const UserModel = models.User;

router.all(('/myself'), (req, res, next) => {
  if (req.guser === undefined) {
    res.sendStatus(400);
    return;
  }
  req.url = `/${req.guser.uid}`;
  next();
});

router.get('/:uuid', authChecker, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const guser = req.guser!;
  const user = await UserModel.findById(guser.uid).lean({ versionKey: false }).exec();
  if (user === null) {
    // If not found, return status 404
    // In this case, expect recourse be created by PUT soon after
    res.sendStatus(404);
  } else {
    res.send({ item: user });
  }
});

router.post('/:uuid', authChecker, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const guser = req.guser!;

  const user = {
    _id: guser.uid,
    name: guser.name as string,
    email: guser.email,
  };

  let userDoc = await UserModel.findOne({ _id: guser.uid }).exec();
  if (userDoc !== null) {
    userDoc.overwrite(user); // properties not in user will not be store into document
    await userDoc.save();
    res.sendStatus(204);
  } else {
    // If the target user does currently not exist, create it
    userDoc = new UserModel(user);
    await userDoc.save();
    res.sendStatus(201);
  }
});

export default router;
