import { Request, Response } from 'express';
import { prisma } from '../server';

export const getDayBooks = async (req: Request, res: Response) => {
  try {
    const { siteId, startDate, endDate } = req.query;
    
    let whereClause: any = {};
    if (siteId) whereClause.siteId = String(siteId);
    
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(String(startDate));
      if (endDate) whereClause.date.lte = new Date(String(endDate));
    }

    const dayBooks = await prisma.dayBook.findMany({
      where: whereClause,
      orderBy: { date: 'desc' },
      include: {
        site: { select: { name: true } }
      }
    });
    res.json({ success: true, data: dayBooks });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDayBook = async (req: Request, res: Response) => {
  try {
    const { siteId, date, expenseType, amount, description, paymentMode, referenceNumber } = req.body;

    const dayBook = await prisma.dayBook.create({
      data: {
        siteId,
        date: new Date(date),
        expenseType,
        amount: parseFloat(amount),
        description,
        paymentMode,
        referenceNumber
      }
    });

    res.status(201).json({ success: true, data: dayBook });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDayBook = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { siteId, date, expenseType, amount, description, paymentMode, referenceNumber } = req.body;

    const dayBook = await prisma.dayBook.update({
      where: { id },
      data: {
        siteId,
        date: date ? new Date(date) : undefined,
        expenseType,
        amount: amount ? parseFloat(amount) : undefined,
        description,
        paymentMode,
        referenceNumber
      }
    });

    res.json({ success: true, data: dayBook });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDayBook = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.dayBook.delete({ where: { id } });
    res.json({ success: true, message: 'DayBook entry deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDayBooksBySite = async (req: Request, res: Response) => {
  try {
    const siteId = req.params.siteId as string;
    await prisma.dayBook.deleteMany({ where: { siteId } });
    res.json({ success: true, message: 'All DayBook entries for this site deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
