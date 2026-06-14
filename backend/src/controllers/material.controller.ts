import { Request, Response } from 'express';
import { prisma } from '../server';

const parseRate = (val: any) => {
  if (val === undefined || val === null || val === "") return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
};

export const getMaterials = async (req: Request, res: Response) => {
  try {
    const materials = await prisma.material.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: materials });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMaterialById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          include: { site: { select: { name: true } } }
        }
      }
    });

    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    res.json({ success: true, data: material });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createMaterial = async (req: Request, res: Response) => {
  try {
    const { name, unit, openingStock, lowStockAlert, rate } = req.body;
    const material = await prisma.material.create({
      data: {
        name: name?.trim().toUpperCase(),
        unit: unit?.trim().toUpperCase(),
        currentStock: parseFloat(openingStock) || 0,
        lowStockAlert: parseFloat(lowStockAlert) || 10,
        rate: parseRate(rate)
      }
    });

    res.status(201).json({ success: true, data: material });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addMaterialTransaction = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { siteId, date, type, quantity, description } = req.body; // type: StockIn, StockOut

    const parsedQuantity = parseFloat(quantity);

    const transaction = await prisma.$transaction(async (tx) => {
      const material = await tx.material.findUnique({ where: { id } });
      if (!material) throw new Error('Material not found');

      if (type === 'StockOut' && material.currentStock < parsedQuantity) {
        throw new Error('Insufficient stock');
      }

      const newTransaction = await tx.materialTransaction.create({
        data: {
          materialId: id,
          siteId: siteId || null,
          date: new Date(date),
          type,
          quantity: parsedQuantity,
          description
        }
      });

      const stockChange = type === 'StockIn' ? parsedQuantity : -parsedQuantity;

      await tx.material.update({
        where: { id },
        data: {
          currentStock: material.currentStock + stockChange
        }
      });

      return newTransaction;
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMaterial = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Delete any dependent transactions first to avoid foreign key violations
    await prisma.materialTransaction.deleteMany({
      where: { materialId: id }
    });

    const material = await prisma.material.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Material deleted successfully', data: material });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMaterial = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, unit, rate } = req.body;
    const material = await prisma.material.update({
      where: { id },
      data: {
        name: name?.trim().toUpperCase(),
        unit: unit?.trim().toUpperCase(),
        rate: rate !== undefined ? parseRate(rate) : undefined
      }
    });

    res.json({ success: true, data: material });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
