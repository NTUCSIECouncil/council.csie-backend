import { Router } from 'express';
import { type IUser } from '@models/UserSchema';
import { models } from '@models/index';

const router = Router();

const UserModel = models.User;

router.get('/:uid', (req, res) => {
  (async () => {
    if (req.uid !== undefined && req.uid === req.params.uid) {
      const targetUser = await UserModel.findOne({ uid: req.uid }).exec();
      if (targetUser !== null) {
        res.json(targetUser.toJSON());
      }
    } else {
      res.sendStatus(403);
    }
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

// TODO: did not check if req.body is an implementation of IUser
router.put('/:uid', (req, res) => {
  (async () => {
    if (req.uid !== undefined && req.uid === req.params.uid) {
      const targetUser = await UserModel.findOne({ uid: req.uid }).exec();
      if (targetUser !== null) {
        const newInfo: IUser = req.body;
        let prop: keyof IUser;
        for (prop in newInfo) {
          targetUser[prop] = newInfo[prop];
        }
        res.sendStatus(204);
      } else {
        res.sendStatus(400);
      }
    } else {
      res.sendStatus(403);
    }
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

// TODO: did not check if user already exist, also did not check req.body
//       也許應該用監聽 firebase 之類的方法創建帳號
router.post('/:uid', (req, res) => {
  (async () => {
    if (req.uid !== undefined && req.uid === req.params.uid) {
      const info: IUser = req.body;
      const newUser = new UserModel(info);
      await newUser.save();
      res.sendStatus(204);
    } else {
      res.sendStatus(403);
    }
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

export default router;
