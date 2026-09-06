import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

dotenv.config();

let prisma: PrismaClient;

if (process.env.DB_TYPE === 'sqlite' || !process.env.DB_TYPE) {
  const url = process.env.DATABASE_URL || 'file:./database.db';
  const adapter = new PrismaBetterSqlite3({ url });
  prisma = new PrismaClient({ adapter });
} else {
  // Just for safety if pg is used
  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

async function main() {
  const siteName = "OM NAMAH SHIVAY";

  // Check if site exists
  let site = await prisma.site.findFirst({
    where: { name: siteName }
  });

  if (!site) {
    console.log(`Site "${siteName}" not found. Creating it...`);
    site = await prisma.site.create({
      data: {
        name: siteName,
        clientName: "System",
        status: "RUNNING",
        startDate: new Date(),
      }
    });
    console.log(`Created site with ID: ${site.id}`);
  } else {
    console.log(`Found site with ID: ${site.id}`);
  }

  // Find all materials that don't have a siteId
  const materials = await prisma.material.findMany({
    where: { siteId: null }
  });

  if (materials.length === 0) {
    console.log("No materials need migration.");
  } else {
    console.log(`Migrating ${materials.length} materials to site "${siteName}"...`);
    const updateResult = await prisma.material.updateMany({
      where: { siteId: null },
      data: { siteId: site.id }
    });
    console.log(`Successfully updated ${updateResult.count} materials.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
