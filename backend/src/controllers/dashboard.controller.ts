import { Request, Response } from 'express';
import { prisma } from '../server';

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const totalSites = await prisma.site.count();
    const activeSites = await prisma.site.count({ where: { status: 'RUNNING' } });

    // Calculate this month's expenses
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthDayBooks = await prisma.dayBook.aggregate({
      _sum: { amount: true },
      where: { date: { gte: startOfMonth } }
    });
    const monthlyExpenses = monthDayBooks._sum.amount || 0;

    // Calculate total ledgers outstanding balance
    const ledgers = await prisma.ledger.aggregate({
      _sum: { outstandingBalance: true }
    });
    const totalOutstanding = ledgers._sum.outstandingBalance || 0;

    // Recent 5 transactions across the app (We'll just fetch 5 recent daybooks for simplicity)
    const recentTransactions = await prisma.dayBook.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: { site: { select: { name: true } } }
    });

    res.json({
      success: true,
      data: {
        totalSites,
        activeSites,
        monthlyExpenses,
        totalOutstanding,
        recentTransactions
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
