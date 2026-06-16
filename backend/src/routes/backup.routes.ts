import express from 'express';
import { runBackup, restoreBackup, getBackupLogs, selectFolder } from '../controllers/backup.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect); // Ensure all routes are protected
router.use(restrictTo('ADMIN')); // Only Admins can view backup logs or run backup/restore operations

router.get('/logs', getBackupLogs);
router.post('/run', runBackup);
router.post('/restore', restoreBackup);
router.post('/select-folder', selectFolder);

export default router;
