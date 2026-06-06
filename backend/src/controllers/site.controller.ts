import { Request, Response } from 'express';
import { prisma } from '../server';

export const getSites = async (req: Request, res: Response) => {
  try {
    const sites = await prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { dayBooks: true }
        }
      }
    });
    res.json({ success: true, data: sites });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSiteById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const site = await prisma.site.findUnique({
      where: { id },
      include: {
        dayBooks: {
          orderBy: { date: 'desc' },
          take: 5
        }
      }
    });

    if (!site) {
      return res.status(404).json({ success: false, message: 'Site not found' });
    }

    res.json({ success: true, data: site });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSite = async (req: Request, res: Response) => {
  try {
    const { name, clientName, address, budget, status, startDate, completionDate, description } = req.body;

    const site = await prisma.site.create({
      data: {
        name,
        clientName,
        address,
        budget: parseFloat(budget) || 0,
        status: status || 'RUNNING',
        startDate: new Date(startDate),
        completionDate: completionDate ? new Date(completionDate) : null,
        description
      }
    });

    res.status(201).json({ success: true, data: site });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSite = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, clientName, address, budget, status, startDate, completionDate, description } = req.body;

    const site = await prisma.site.update({
      where: { id },
      data: {
        name,
        clientName,
        address,
        budget: budget ? parseFloat(budget) : undefined,
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        completionDate: completionDate ? new Date(completionDate) : undefined,
        description
      }
    });

    res.json({ success: true, data: site });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSite = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Get all DayBook entries for this site to identify associated Ledger names
    const siteDaybooks = await prisma.dayBook.findMany({
      where: { siteId: id }
    });

    // Find all unique ledger names used in these daybooks
    const ledgerNames = new Set<string>();
    for (const db of siteDaybooks) {
      const text = db.expenseType || "";
      let name = "";
      if (text.toUpperCase().startsWith("TO ")) {
        name = text.substring(3).trim().toUpperCase();
      } else if (text.toUpperCase().startsWith("BY ")) {
        name = text.substring(3).trim().toUpperCase();
      }
      if (name) {
        ledgerNames.add(name);
      }
    }

    // Delete related DayBooks and MaterialTransactions
    await prisma.dayBook.deleteMany({ where: { siteId: id } });
    await prisma.materialTransaction.deleteMany({ where: { siteId: id } });

    // For each unique ledger name, check if it's referenced in any other DayBook entries (for other sites).
    // If not, delete it from the Ledger table.
    for (const name of ledgerNames) {
      const otherUsage = await prisma.dayBook.findFirst({
        where: {
          OR: [
            { expenseType: { startsWith: `To ${name}`, mode: 'insensitive' } },
            { expenseType: { startsWith: `By ${name}`, mode: 'insensitive' } }
          ]
        }
      });

      if (!otherUsage) {
        // Find the ledger record in database
        const ledger = await prisma.ledger.findFirst({
          where: {
            name: {
              equals: name,
              mode: 'insensitive'
            }
          }
        });

        if (ledger) {
          // Delete its transactions first, then the ledger itself
          await prisma.ledgerTransaction.deleteMany({
            where: { ledgerId: ledger.id }
          });
          await prisma.ledger.delete({
            where: { id: ledger.id }
          });
        }
      }
    }

    await prisma.site.delete({ where: { id } });

    res.json({ success: true, message: 'Site and its related DayBook and exclusive Ledgers deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
