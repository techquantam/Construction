import express from 'express';
import { getSites, getSiteById, createSite, updateSite, deleteSite, clearSiteAccountsData } from '../controllers/site.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect); // All site routes are protected

router.route('/')
  .get(getSites)
  .post(restrictTo('ADMIN'), createSite);

router.route('/:id/clear-accounts-data')
  .delete(restrictTo('ADMIN'), clearSiteAccountsData)
  .post(restrictTo('ADMIN'), clearSiteAccountsData);

router.route('/:id')
  .get(getSiteById)
  .put(restrictTo('ADMIN'), updateSite)
  .delete(restrictTo('ADMIN'), deleteSite);

export default router;
