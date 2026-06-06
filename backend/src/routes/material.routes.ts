import express from 'express';
import { getMaterials, getMaterialById, createMaterial, addMaterialTransaction, deleteMaterial } from '../controllers/material.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getMaterials)
  .post(createMaterial);

router.route('/:id')
  .get(getMaterialById)
  .delete(deleteMaterial);

router.route('/:id/transactions')
  .post(addMaterialTransaction);

export default router;
