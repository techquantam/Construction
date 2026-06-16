import express from 'express';
import { getLedgers, getLedgerById, createLedger, addLedgerTransaction, updateLedger, deleteLedger, deleteLedgerData } from '../controllers/ledger.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getLedgers)
  .post(restrictTo('ADMIN'), createLedger);

router.route('/:id/data')
  .delete(restrictTo('ADMIN'), deleteLedgerData);

router.route('/:id/transactions')
  .post(restrictTo('ADMIN'), addLedgerTransaction);

router.route('/:id')
  .get(getLedgerById)
  .put(restrictTo('ADMIN'), updateLedger)
  .delete(restrictTo('ADMIN'), deleteLedger);

export default router;
