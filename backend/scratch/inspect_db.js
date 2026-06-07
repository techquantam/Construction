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
  const sites = await prisma.site.findMany({
    select: { id: true, name: true }
  });
  console.log('--- SITES ---');
  console.log(sites);

  const matchedDaybooks = await prisma.dayBook.findMany({
    where: {
      OR: [
        { expenseType: { startsWith: 'To DEEPAK', mode: 'insensitive' } },
        { expenseType: { startsWith: 'By DEEPAK', mode: 'insensitive' } }
      ]
    }
  });
  console.log('--- MATCHED DAYBOOKS ---');
  console.log(matchedDaybooks);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
