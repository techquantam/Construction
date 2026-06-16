const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const daybooks = await prisma.dayBook.findMany({
    orderBy: { date: 'asc' }
  });
  console.log("Daybook entries count:", daybooks.length);
  if (daybooks.length > 0) {
    console.log("First daybook date:", daybooks[0].date, typeof daybooks[0].date);
    console.log("Last daybook date:", daybooks[daybooks.length - 1].date);
    console.log("Sample items (first 5):");
    daybooks.slice(0, 5).forEach((d, i) => {
      console.log(`[${i}] date:`, d.date, "ISO:", d.date.toISOString(), "expenseType:", d.expenseType, "amount:", d.amount);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
