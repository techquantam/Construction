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
  // 1. Find the site ID for "OM NAMAH SHIVAY"
  const sites = await prisma.site.findMany({
    where: {
      name: { contains: 'OM NAMAH SHIVAY', mode: 'insensitive' }
    }
  });
  console.log('--- MATCHING SITES ---');
  console.log(sites);

  if (sites.length === 0) {
    console.log('No site found matching OM NAMAH SHIVAY');
    return;
  }

  const siteId = sites[0].id;

  // 2. Fetch ledgers for this site
  const ledgers = await prisma.ledger.findMany({
    where: { siteId }
  });
  console.log('--- LEDGERS FOR THIS SITE ---');
  console.log(ledgers);

  // 3. Fetch daybooks for this site
  const daybooks = await prisma.dayBook.findMany({
    where: { siteId }
  });
  console.log(`--- DAYBOOKS FOR THIS SITE (${daybooks.length} records) ---`);
  console.log(daybooks.slice(0, 10)); // first 10
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
