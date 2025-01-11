import express from 'express';
import namesRoutes from './names';

const router = express.Router();

router.use('/names', namesRoutes);

export default router;