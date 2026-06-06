import express from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.get('/summary', getDashboardSummary);

export default router;
