import express from 'express';
import namesRoutes from './names.js';

const router = express.Router();

router.use('/names', namesRoutes);

export default router;