import { Router } from 'express';
import ExampleController from './ExampleController';
import UserInfoController from './UserInfoController';

const router = Router();

router.use('/example', ExampleController);
router.use('/users', UserInfoController);

export default router;
