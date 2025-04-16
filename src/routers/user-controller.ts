import { Router } from 'express';
import { ZUserSchema } from '@/models/user-schema.ts';
import { models } from '@models/index.ts';
import { authChecker } from './middleware.ts';

const router = Router();

const UserModel = models.User;

router.use('/me', (req, res, next) => {
  if (req.guser === undefined) {
    res.sendStatus(400);
    return;
  }
  const restPath = req.url.replace(/^\/myself/, '');
  req.url = `/${req.guser.uid}${restPath}`;
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
    res.json({ user });
  }
});

router.post('/:uuid', authChecker, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- authChecker() checked
  const guser = req.guser!;

  const user = ZUserSchema.parse({ _id: guser.uid, name: guser.displayName, email: guser.email });

  let userDoc = await UserModel.findOne({ _id: guser.uid }).exec();
  if (userDoc !== null) {
    userDoc.overwrite(user);
    await userDoc.save();
    res.sendStatus(204);
  } else {
    userDoc = new UserModel(user);
    await userDoc.save();
    res.status(201).json({ userId: guser.uid });
  }
});

export default router;
