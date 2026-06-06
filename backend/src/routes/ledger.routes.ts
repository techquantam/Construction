import express from 'express';
import { getLedgers, getLedgerById, createLedger, addLedgerTransaction, updateLedger, deleteLedger } from '../controllers/ledger.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getLedgers)
  .post(createLedger);

router.route('/:id')
  .get(getLedgerById)
  .put(updateLedger)
  .delete(deleteLedger);

router.route('/:id/transactions')
  .post(addLedgerTransaction);

export default router;
