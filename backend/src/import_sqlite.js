const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const url = process.env.DATABASE_URL || 'file:./database.db';
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

// Hardcoded backup file name from our step 1
const BACKUP_FILE_NAME = 'neon_backup_2026-06-29T07-21-23-176Z.json';

async function runMigration() {
  console.log('Starting data migration from Neon Backup to SQLite...');
  
  const backupFilePath = path.join(__dirname, '..', 'backups', BACKUP_FILE_NAME);
  if (!fs.existsSync(backupFilePath)) {
    console.error(`Error: Backup file not found at ${backupFilePath}`);
    process.exit(1);
  }

  console.log(`Reading backup file: ${BACKUP_FILE_NAME}`);
  const backupRaw = fs.readFileSync(backupFilePath, 'utf-8');
  const backup = JSON.parse(backupRaw);
  const { data } = backup;

  try {
    // We will clean the SQLite database first to avoid duplicate errors if run multiple times
    console.log('Cleaning existing data in SQLite...');
    await prisma.backupLog.deleteMany();
    await prisma.materialTransaction.deleteMany();
    await prisma.ledgerTransaction.deleteMany();
    await prisma.dayBook.deleteMany();
    await prisma.ledger.deleteMany();
    await prisma.material.deleteMany();
    await prisma.site.deleteMany();
    await prisma.admin.deleteMany();
    console.log('SQLite database cleaned.');

    // 1. Migrate Admin
    if (data.Admin && data.Admin.length > 0) {
      console.log(`Migrating ${data.Admin.length} Admins...`);
      for (const admin of data.Admin) {
        await prisma.admin.create({
          data: {
            ...admin,
            createdAt: new Date(admin.createdAt),
            updatedAt: new Date(admin.updatedAt)
          }
        });
      }
    }

    // 2. Migrate Site
    if (data.Site && data.Site.length > 0) {
      console.log(`Migrating ${data.Site.length} Sites...`);
      for (const site of data.Site) {
        await prisma.site.create({
          data: {
            ...site,
            startDate: new Date(site.startDate),
            completionDate: site.completionDate ? new Date(site.completionDate) : null,
            createdAt: new Date(site.createdAt),
            updatedAt: new Date(site.updatedAt)
          }
        });
      }
    }

    // 3. Migrate Material
    if (data.Material && data.Material.length > 0) {
      console.log(`Migrating ${data.Material.length} Materials...`);
      for (const material of data.Material) {
        await prisma.material.create({
          data: {
            ...material,
            createdAt: new Date(material.createdAt),
            updatedAt: new Date(material.updatedAt)
          }
        });
      }
    }

    // 4. Migrate Ledger
    if (data.Ledger && data.Ledger.length > 0) {
      console.log(`Migrating ${data.Ledger.length} Ledgers...`);
      for (const ledger of data.Ledger) {
        await prisma.ledger.create({
          data: {
            ...ledger,
            createdAt: new Date(ledger.createdAt),
            updatedAt: new Date(ledger.updatedAt)
          }
        });
      }
    }

    // 5. Migrate DayBook
    if (data.DayBook && data.DayBook.length > 0) {
      console.log(`Migrating ${data.DayBook.length} DayBooks...`);
      // We do this in batches of 50 or individually to be safe and report progress
      let count = 0;
      for (const dayBook of data.DayBook) {
        await prisma.dayBook.create({
          data: {
            ...dayBook,
            date: new Date(dayBook.date),
            createdAt: new Date(dayBook.createdAt),
            updatedAt: new Date(dayBook.updatedAt)
          }
        });
        count++;
        if (count % 100 === 0) {
          console.log(`- Imported ${count}/${data.DayBook.length} DayBooks...`);
        }
      }
    }

    // 6. Migrate LedgerTransaction
    if (data.LedgerTransaction && data.LedgerTransaction.length > 0) {
      console.log(`Migrating ${data.LedgerTransaction.length} LedgerTransactions...`);
      for (const lt of data.LedgerTransaction) {
        await prisma.ledgerTransaction.create({
          data: {
            ...lt,
            date: new Date(lt.date),
            createdAt: new Date(lt.createdAt)
          }
        });
      }
    }

    // 7. Migrate MaterialTransaction
    if (data.MaterialTransaction && data.MaterialTransaction.length > 0) {
      console.log(`Migrating ${data.MaterialTransaction.length} MaterialTransactions...`);
      for (const mt of data.MaterialTransaction) {
        await prisma.materialTransaction.create({
          data: {
            ...mt,
            date: new Date(mt.date),
            createdAt: new Date(mt.createdAt)
          }
        });
      }
    }

    // 8. Migrate BackupLog
    if (data.BackupLog && data.BackupLog.length > 0) {
      console.log(`Migrating ${data.BackupLog.length} BackupLogs...`);
      for (const log of data.BackupLog) {
        await prisma.backupLog.create({
          data: {
            ...log,
            createdAt: new Date(log.createdAt)
          }
        });
      }
    }

    console.log('\n=============================================');
    console.log('Data Migration Completed Successfully!');
    console.log('All data has been imported into SQLite database.db');
    console.log('=============================================');

  } catch (error) {
    console.error('Error during data migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
