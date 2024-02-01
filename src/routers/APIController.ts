import { Router } from 'express';
import articleController from './ArticleController';
import exampleController from './ExampleController';
import userInfoController from './UserInfoController';

const router = Router();

router.use('/articles', articleController);
router.use('/example', exampleController);
router.use('/users', userInfoController);

export default router;
