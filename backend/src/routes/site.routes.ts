import express from 'express';
import { getSites, getSiteById, createSite, updateSite, deleteSite } from '../controllers/site.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect); // All site routes are protected

router.route('/')
  .get(getSites)
  .post(createSite);

router.route('/:id')
  .get(getSiteById)
  .put(updateSite)
  .delete(deleteSite);

export default router;
