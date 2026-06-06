import express from 'express';
import { loginAdmin, getMe, setupAdmin } from '../controllers/admin.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/login', loginAdmin);
router.post('/setup', setupAdmin);
router.get('/me', protect, getMe);

export default router;
