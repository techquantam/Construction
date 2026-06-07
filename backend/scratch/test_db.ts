import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runTest() {
  try {
    console.log("Connecting to database...");
    await prisma.$connect();
    console.log("Connected.");

    // Fetch one ledger and its name
    const ledgers = await prisma.ledger.findMany({
      take: 5
    });
    console.log("Existing ledgers:", ledgers.map(l => ({ id: l.id, name: l.name, type: l.type })));

    if (ledgers.length === 0) {
      console.log("No ledgers found in database.");
      return;
    }

    const testLedger = ledgers[0];
    const name = testLedger.name;
    console.log(`Using ledger for test delete query: Name="${name}", ID="${testLedger.id}"`);

    // Let's test the query inside transaction
    await prisma.$transaction(async (tx) => {
      let dayBookWhereClause: any = {
        OR: [
          { expenseType: { startsWith: `To ${name}`, mode: 'insensitive' } },
          { expenseType: { startsWith: `By ${name}`, mode: 'insensitive' } }
        ]
      };
      
      console.log("Running deleteMany on dayBook with clause:", JSON.stringify(dayBookWhereClause));
      const result = await tx.dayBook.deleteMany({
        where: dayBookWhereClause
      });
      console.log("deleteMany result:", result);
    });

  } catch (error: any) {
    console.error("DB Query Failed! Error Stack:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runTest();
