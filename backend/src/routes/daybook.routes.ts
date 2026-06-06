import express from 'express';
import { getDayBooks, createDayBook, updateDayBook, deleteDayBook, deleteDayBooksBySite } from '../controllers/daybook.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getDayBooks)
  .post(createDayBook);

router.route('/site/:siteId')
  .delete(deleteDayBooksBySite);

router.route('/:id')
  .put(updateDayBook)
  .delete(deleteDayBook);

export default router;
