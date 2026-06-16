import express from 'express';
import { getMaterials, getMaterialById, createMaterial, addMaterialTransaction, deleteMaterial, updateMaterial } from '../controllers/material.controller';
import { protect, restrictTo } from '../middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getMaterials)
  .post(restrictTo('ADMIN'), createMaterial);

router.route('/:id')
  .get(getMaterialById)
  .put(restrictTo('ADMIN'), updateMaterial)
  .delete(restrictTo('ADMIN'), deleteMaterial);

router.route('/:id/transactions')
  .post(restrictTo('ADMIN'), addMaterialTransaction);

export default router;
