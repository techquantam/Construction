import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runBackup() {
  console.log('Starting Neon PostgreSQL database backup...');
  
  try {
    // 1. Fetch data from all tables
    console.log('Fetching data from tables...');
    
    const admins = await prisma.admin.findMany();
    console.log(`- Admin: ${admins.length} records`);
    
    const sites = await prisma.site.findMany();
    console.log(`- Site: ${sites.length} records`);
    
    const dayBooks = await prisma.dayBook.findMany();
    console.log(`- DayBook: ${dayBooks.length} records`);
    
    const ledgers = await prisma.ledger.findMany();
    console.log(`- Ledger: ${ledgers.length} records`);
    
    const ledgerTransactions = await prisma.ledgerTransaction.findMany();
    console.log(`- LedgerTransaction: ${ledgerTransactions.length} records`);
    
    const materials = await prisma.material.findMany();
    console.log(`- Material: ${materials.length} records`);
    
    const materialTransactions = await prisma.materialTransaction.findMany();
    console.log(`- MaterialTransaction: ${materialTransactions.length} records`);
    
    const backupLogs = await prisma.backupLog.findMany();
    console.log(`- BackupLog: ${backupLogs.length} records`);

    const backupData = {
      timestamp: new Date().toISOString(),
      source: 'Neon PostgreSQL',
      data: {
        Admin: admins,
        Site: sites,
        DayBook: dayBooks,
        Ledger: ledgers,
        LedgerTransaction: ledgerTransactions,
        Material: materials,
        MaterialTransaction: materialTransactions,
        BackupLog: backupLogs
      }
    };

    // 2. Define backup directory and filename
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `neon_backup_${timestampStr}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // 3. Write data to JSON file
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
    
    console.log('\n=============================================');
    console.log(`Backup completed successfully!`);
    console.log(`Saved to: ${backupFilePath}`);
    console.log('=============================================');
    
    // Summary of records
    console.log('\nSummary of backed up records:');
    console.log(`- Admin: ${admins.length}`);
    console.log(`- Site: ${sites.length}`);
    console.log(`- DayBook: ${dayBooks.length}`);
    console.log(`- Ledger: ${ledgers.length}`);
    console.log(`- LedgerTransaction: ${ledgerTransactions.length}`);
    console.log(`- Material: ${materials.length}`);
    console.log(`- MaterialTransaction: ${materialTransactions.length}`);
    console.log(`- BackupLog: ${backupLogs.length}`);
    
  } catch (error) {
    console.error('Error during backup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runBackup();
