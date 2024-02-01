import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ msg: 'Here is an example.' });
});

export default router;
