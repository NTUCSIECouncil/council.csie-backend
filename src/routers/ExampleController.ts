import { Router } from 'express';

const router = Router();

router.use((req, res, next) => {
  res.send('Here is an example.');
  next();
});

export default router;
