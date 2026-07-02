const { Client } = require('pg');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const neonConnectionString = process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_gyvBu7ZsnIT3@ep-tiny-rain-aou2j6wf-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const sqliteUrl = process.env.DATABASE_URL || 'file:./database.db';

console.log('Connecting to Neon Database...');
const pgClient = new Client({ connectionString: neonConnectionString });

const adapter = new PrismaBetterSqlite3({ url: sqliteUrl });
const prisma = new PrismaClient({ adapter });

async function sync() {
  try {
    await pgClient.connect();
    console.log('Connected to Neon Database successfully!');

    // 1. Fetch all tables from Neon PostgreSQL
    console.log('Fetching fresh data from Neon PostgreSQL...');

    const adminsRes = await pgClient.query('SELECT * FROM "Admin"');
    const sitesRes = await pgClient.query('SELECT * FROM "Site"');
    const dayBooksRes = await pgClient.query('SELECT * FROM "DayBook"');
    const ledgersRes = await pgClient.query('SELECT * FROM "Ledger"');
    const ledgerTransactionsRes = await pgClient.query('SELECT * FROM "LedgerTransaction"');
    const materialsRes = await pgClient.query('SELECT * FROM "Material"');
    const materialTransactionsRes = await pgClient.query('SELECT * FROM "MaterialTransaction"');
    const backupLogsRes = await pgClient.query('SELECT * FROM "BackupLog"');

    console.log(`Fetched:
- Admin: ${adminsRes.rows.length} records
- Site: ${sitesRes.rows.length} records
- DayBook: ${dayBooksRes.rows.length} records
- Ledger: ${ledgersRes.rows.length} records
- LedgerTransaction: ${ledgerTransactionsRes.rows.length} records
- Material: ${materialsRes.rows.length} records
- MaterialTransaction: ${materialTransactionsRes.rows.length} records
- BackupLog: ${backupLogsRes.rows.length} records`);

    // 2. Clean SQLite
    console.log('Cleaning local SQLite database...');
    await prisma.backupLog.deleteMany();
    await prisma.materialTransaction.deleteMany();
    await prisma.ledgerTransaction.deleteMany();
    await prisma.dayBook.deleteMany();
    await prisma.ledger.deleteMany();
    await prisma.material.deleteMany();
    await prisma.site.deleteMany();
    await prisma.admin.deleteMany();
    console.log('SQLite database cleaned.');

    // 3. Migrate data
    console.log('Writing records to local SQLite...');

    // Admin
    if (adminsRes.rows.length > 0) {
      for (const row of adminsRes.rows) {
        await prisma.admin.create({ data: row });
      }
      console.log('✓ Admins migrated');
    }

    // Site
    if (sitesRes.rows.length > 0) {
      for (const row of sitesRes.rows) {
        await prisma.site.create({ data: row });
      }
      console.log('✓ Sites migrated');
    }

    // Material
    if (materialsRes.rows.length > 0) {
      for (const row of materialsRes.rows) {
        await prisma.material.create({ data: row });
      }
      console.log('✓ Materials migrated');
    }

    // Ledger
    if (ledgersRes.rows.length > 0) {
      for (const row of ledgersRes.rows) {
        await prisma.ledger.create({ data: row });
      }
      console.log('✓ Ledgers migrated');
    }

    // DayBook
    if (dayBooksRes.rows.length > 0) {
      let count = 0;
      for (const row of dayBooksRes.rows) {
        await prisma.dayBook.create({ data: row });
        count++;
        if (count % 100 === 0) {
          console.log(`  Imported ${count}/${dayBooksRes.rows.length} DayBooks...`);
        }
      }
      console.log('✓ DayBooks migrated');
    }

    // LedgerTransaction
    if (ledgerTransactionsRes.rows.length > 0) {
      for (const row of ledgerTransactionsRes.rows) {
        await prisma.ledgerTransaction.create({ data: row });
      }
      console.log('✓ LedgerTransactions migrated');
    }

    // MaterialTransaction
    if (materialTransactionsRes.rows.length > 0) {
      for (const row of materialTransactionsRes.rows) {
        await prisma.materialTransaction.create({ data: row });
      }
      console.log('✓ MaterialTransactions migrated');
    }

    // BackupLog
    if (backupLogsRes.rows.length > 0) {
      for (const row of backupLogsRes.rows) {
        await prisma.backupLog.create({ data: row });
      }
      console.log('✓ BackupLogs migrated');
    }

    console.log('\n=============================================');
    console.log('Sync from Neon to SQLite completed successfully!');
    console.log('=============================================');

  } catch (error) {
    console.error('Sync failed:', error);
  } finally {
    await pgClient.end();
    await prisma.$disconnect();
  }
}

sync();
