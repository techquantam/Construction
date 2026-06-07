import { Request, Response } from 'express';
import { prisma } from '../server';

export const getLedgers = async (req: Request, res: Response) => {
  try {
    const { type } = req.query; // Party, Supplier, Contractor
    let whereClause = type ? { type: String(type) } : {};

    const ledgers = await prisma.ledger.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, data: ledgers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLedgerById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const ledger = await prisma.ledger.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!ledger) {
      return res.status(404).json({ success: false, message: 'Ledger not found' });
    }

    res.json({ success: true, data: ledger });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createLedger = async (req: Request, res: Response) => {
  try {
    const { type, name, contactPerson, phone, openingBalance } = req.body;

    const ledger = await prisma.ledger.create({
      data: {
        type,
        name,
        contactPerson,
        phone,
        outstandingBalance: parseFloat(openingBalance) || 0
      }
    });

    res.status(201).json({ success: true, data: ledger });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addLedgerTransaction = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { date, type, amount, description } = req.body;

    const parsedAmount = parseFloat(amount);

    const transaction = await prisma.$transaction(async (tx) => {
      const newTransaction = await tx.ledgerTransaction.create({
        data: {
          ledgerId: id,
          date: new Date(date),
          type, // Debit, Credit
          amount: parsedAmount,
          description
        }
      });

      const ledger = await tx.ledger.findUnique({ where: { id } });
      if (!ledger) throw new Error('Ledger not found');

      // Update outstanding balance
      // If type === 'Debit' (we paid them / gave them money) -> Balance decreases
      // If type === 'Credit' (they gave us material/service) -> Balance increases
      const balanceChange = type === 'Credit' ? parsedAmount : -parsedAmount;

      await tx.ledger.update({
        where: { id },
        data: {
          outstandingBalance: ledger.outstandingBalance + balanceChange
        }
      });

      return newTransaction;
    });

    res.status(201).json({ success: true, data: transaction });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLedger = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { type, name, contactPerson, phone, outstandingBalance } = req.body;

    const oldLedger = await prisma.ledger.findUnique({ where: { id } });
    if (!oldLedger) {
      return res.status(404).json({ success: false, message: 'Ledger not found' });
    }

    const ledger = await prisma.$transaction(async (tx) => {
      const updatedLedger = await tx.ledger.update({
        where: { id },
        data: {
          type,
          name,
          contactPerson,
          phone,
          outstandingBalance: outstandingBalance !== undefined ? parseFloat(outstandingBalance) : undefined
        }
      });

      if (name && oldLedger.name.toUpperCase() !== name.toUpperCase()) {
        const oldUpper = oldLedger.name.toUpperCase();
        const newUpper = name.toUpperCase();

        const daybooks = await tx.dayBook.findMany();
        for (const db of daybooks) {
          const typeText = db.expenseType || "";
          let prefix = "";
          let dbName = "";
          if (typeText.toUpperCase().startsWith("TO ")) {
            prefix = typeText.substring(0, 3);
            dbName = typeText.substring(3).trim();
          } else if (typeText.toUpperCase().startsWith("BY ")) {
            prefix = typeText.substring(0, 3);
            dbName = typeText.substring(3).trim();
          }
          if (dbName.toUpperCase() === oldUpper) {
            const newExpenseType = `${prefix}${newUpper}`;
            await tx.dayBook.update({
              where: { id: db.id },
              data: { expenseType: newExpenseType }
            });
          }
        }
      }

      return updatedLedger;
    });

    res.json({ success: true, data: ledger });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteLedger = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Find the ledger record first to get its name
    const ledger = await prisma.ledger.findUnique({ where: { id } });
    if (!ledger) {
      return res.status(404).json({ success: false, message: 'Ledger not found' });
    }

    const name = ledger.name;

    await prisma.$transaction(async (tx) => {
      await tx.ledgerTransaction.deleteMany({
        where: { ledgerId: id }
      });

      // Delete all DayBook entries matching this ledger's name
      await tx.dayBook.deleteMany({
        where: {
          OR: [
            { expenseType: { startsWith: `To ${name}`, mode: 'insensitive' } },
            { expenseType: { startsWith: `By ${name}`, mode: 'insensitive' } }
          ]
        }
      });

      await tx.ledger.delete({
        where: { id }
      });
    });

    res.json({ success: true, message: 'Ledger and all its transactions and DayBook entries deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteLedgerData = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { siteId } = req.query;

    const ledger = await prisma.ledger.findUnique({ where: { id } });
    if (!ledger) {
      return res.status(404).json({ success: false, message: 'Ledger not found' });
    }

    const name = ledger.name;

    await prisma.$transaction(async (tx) => {
      let dayBookWhereClause: any = {
        OR: [
          { expenseType: { startsWith: `To ${name}`, mode: 'insensitive' } },
          { expenseType: { startsWith: `By ${name}`, mode: 'insensitive' } }
        ]
      };
      if (siteId) {
        dayBookWhereClause.siteId = String(siteId);
      }

      await tx.dayBook.deleteMany({
        where: dayBookWhereClause
      });

      if (!siteId) {
        await tx.ledgerTransaction.deleteMany({
          where: { ledgerId: id }
        });
        await tx.ledger.update({
          where: { id },
          data: { outstandingBalance: 0 }
        });
      }
    });

    res.json({ success: true, message: 'Ledger data deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

