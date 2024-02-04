import { Router } from 'express';
import { type User } from '@models/UserSchema';
import { models } from '@models/index';

const router = Router();

const UserModel = models.User;

router.get('/:uid?', (req, res) => {
  (async () => {
    if (req.params.uid === undefined || req.guser?.uid === req.params.uid) {
      // access itself
      if (req.guser?.uid === undefined) {
        res.sendStatus(403);
      } else {
        let targetUser = await UserModel.findOne({ uid: req.guser.uid });
        if (targetUser == null) {
          targetUser = new UserModel({
            uid: req.guser.uid,
            name: req.guser.name,
            email: req.guser.email
          });
          await targetUser.save();
        }
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
// router.put('/:uid', (req, res) => {
//   (async () => {
//     if (req.guser?.uid !== undefined && req.guser?.uid === req.params.uid) {
//       const targetUser = await UserModel.findOne({ uid: req.guser?.uid }).exec();
//       if (targetUser !== null) {
//         const newInfo: IUser = req.body;
//         let prop: keyof IUser;
//         for (prop in newInfo) {
//           targetUser[prop] = newInfo[prop];
//         }
//         res.sendStatus(204);
//       } else {
//         res.sendStatus(400);
//       }
//     } else {
//       res.sendStatus(403);
//     }
//   })().catch((err) => {
//     console.log(err);
//     res.sendStatus(500);
//   });
// });

// TODO: did not check if user already exist, also did not check req.body
//       也許應該用監聽 firebase 之類的方法創建帳號
router.post('/:uid', (req, res) => {
  (async () => {
    if (req.guser?.uid !== undefined && req.guser?.uid === req.params.uid) {
      const info: User = req.body;
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
