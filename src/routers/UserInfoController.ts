import { Router } from 'express';
import { type User } from '@models/UserSchema';
import { models } from '@models/index';

const router = Router();

const UserModel = models.User;

router.get('/:uid', (req, res) => {
  (async () => {
    if (req.guser?.uid === undefined || req.guser?.uid !== req.params.uid) {
      res.sendStatus(403);
    } else {
      const targetUser = await UserModel.findOne({ uid: req.guser.uid }).exec();
      if (targetUser === null) {
        // If not found, return status 404
        // In this case, expect recourse be created by PUT soon after
        res.sendStatus(404);
      } else {
        res.json(targetUser.toJSON());
      }
    }
    // if (req.params.uid === undefined || req.guser?.uid === req.params.uid) {
    //   // access itself
    //   if (req.guser?.uid === undefined) {
    //     res.sendStatus(403);
    //   } else {
    //     let targetUser = await UserModel.findOne({ uid: req.guser.uid }).exec();
    //     if (targetUser == null) {
    //       targetUser = new UserModel({
    //         uid: req.guser.uid,
    //         name: req.guser.name,
    //         email: req.guser.email
    //       });
    //       await targetUser.save();
    //     }
    //     res.json(targetUser.toJSON());
    //   }
    // } else {
    //   res.sendStatus(403);
    // }
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

router.put('/:uid', (req, res) => {
  (async () => {
    if (req.guser?.uid === undefined || req.guser?.uid !== req.params.uid) {
      res.sendStatus(403);
    } else {
      const newInfo: Partial<User> = req.body;
      let targetUser = await UserModel.findOne({ uid: req.guser.uid }).exec();
      if (targetUser !== null) {
        targetUser.set(newInfo); // properties not in User will not be store into document
        await targetUser.save();
        res.sendStatus(204);
      } else {
        // If the target user does currently not exist, create it
        targetUser = new UserModel({
          uid: req.guser.uid,
          name: req.guser.name,
          email: req.guser.email
        });
        targetUser.set(newInfo);
        await targetUser.save();
        res.sendStatus(201);
      }
    }
  })().catch((err) => {
    console.log(err);
    res.sendStatus(500);
  });
});

// TODO: did not check if user already exist, also did not check req.body
//       也許應該用監聽 firebase 之類的方法創建帳號
// Update: 使用 PUT 建立帳號，應該不需要了
// router.post('/:uid', (req, res) => {
//   (async () => {
//     if (req.guser?.uid !== undefined && req.guser?.uid === req.params.uid) {
//       const info: User = req.body;
//       const newUser = new UserModel(info);
//       await newUser.save();
//       res.sendStatus(204);
//     } else {
//       res.sendStatus(403);
//     }
//   })().catch((err) => {
//     console.log(err);
//     res.sendStatus(500);
//   });
// });

export default router;
