import express from 'express';
import { getDayBooks, createDayBook, updateDayBook, deleteDayBook, deleteDayBooksBySite } from '../controllers/daybook.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getDayBooks)
  .post(restrictTo('ADMIN'), createDayBook);

router.route('/site/:siteId')
  .delete(restrictTo('ADMIN'), deleteDayBooksBySite);

router.route('/:id')
  .put(restrictTo('ADMIN'), updateDayBook)
  .delete(restrictTo('ADMIN'), deleteDayBook);

export default router;
