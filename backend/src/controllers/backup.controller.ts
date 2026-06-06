import { Request, Response } from 'express';
import { prisma } from '../server';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export const runBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { backupPath } = req.body;

    // 1. Fetch all data from the database
    const admins = await prisma.admin.findMany();
    const sites = await prisma.site.findMany();
    const dayBooks = await prisma.dayBook.findMany();
    const ledgers = await prisma.ledger.findMany();
    const ledgerTransactions = await prisma.ledgerTransaction.findMany();
    const materials = await prisma.material.findMany();
    const materialTransactions = await prisma.materialTransaction.findMany();

    const backupData = {
      admins,
      sites,
      dayBooks,
      ledgers,
      ledgerTransactions,
      materials,
      materialTransactions,
      exportedAt: new Date().toISOString(),
    };

    let filePath = "";
    let fileName = "";

    if (backupPath) {
      // Replace drive letter and backslashes on non-windows platform to prevent permission errors
      let adjustedPath = backupPath;
      if (process.platform !== 'win32') {
        adjustedPath = backupPath.replace(/^[a-zA-Z]:/, '').replace(/\\/g, '/');
        if (adjustedPath.startsWith('/')) {
          adjustedPath = adjustedPath.substring(1);
        }
      }
      const normalizedPath = path.normalize(adjustedPath);
      // Ensure file ends in .bak
      filePath = normalizedPath.toLowerCase().endsWith('.bak') ? normalizedPath : `${normalizedPath}.bak`;
      fileName = path.basename(filePath);
      
      const dir = path.dirname(filePath);
      if (dir && dir !== '.' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } else {
      // 2. Generate default backup filename
      const today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fileName = `Tele${day}.${month}.${year}.bak`;
      filePath = path.join(BACKUP_DIR, fileName);
    }

    // 3. Write data to file (JSON serialized database inside a .bak file)
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

    // 4. Create log record in the database
    const backupLog = await prisma.backupLog.create({
      data: {
        fileName,
        fileUrl: filePath, // Store absolute path
      },
    });

    res.status(201).json({
      success: true,
      message: 'Database backup completed successfully',
      data: backupLog,
    });
  } catch (error: any) {
    console.error('Backup failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const restoreBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, backupPath } = req.body; // Backup log ID or raw backupPath

    let filePath = "";
    let fileName = "custom restore point";

    if (id) {
      const backupLog = await prisma.backupLog.findUnique({
        where: { id },
      });

      if (!backupLog) {
        res.status(404).json({ success: false, message: 'Backup record not found in database' });
        return;
      }

      filePath = backupLog.fileUrl || path.join(BACKUP_DIR, backupLog.fileName);
      fileName = backupLog.fileName;
    } else if (backupPath) {
      // Replace drive letter and backslashes on non-windows platform
      let adjustedPath = backupPath;
      if (process.platform !== 'win32') {
        adjustedPath = backupPath.replace(/^[a-zA-Z]:/, '').replace(/\\/g, '/');
        if (adjustedPath.startsWith('/')) {
          adjustedPath = adjustedPath.substring(1);
        }
      }
      filePath = path.normalize(adjustedPath);
      fileName = path.basename(filePath);
    } else {
      res.status(400).json({ success: false, message: 'Backup Log ID or Backup Path is required' });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: `Backup file ${fileName} not found on disk at ${filePath}` });
      return;
    }

    // Read the backup data from file
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const backupData = JSON.parse(rawData);

    // Run delete and insert operations inside a single Prisma transaction to ensure integrity
    await prisma.$transaction(async (tx) => {
      // 1. Delete all current table contents (order matters due to foreign keys)
      await tx.backupLog.deleteMany({ where: { id: { not: id } } }); // Keep current restore log record
      await tx.materialTransaction.deleteMany();
      await tx.ledgerTransaction.deleteMany();
      await tx.dayBook.deleteMany();
      await tx.material.deleteMany();
      await tx.ledger.deleteMany();
      await tx.site.deleteMany();
      // Keep admin account so the user is not locked out

      // 2. Restore all data from the backup object
      
      // Sites
      if (backupData.sites?.length) {
        await tx.site.createMany({
          data: backupData.sites.map((s: any) => ({
            ...s,
            startDate: new Date(s.startDate),
            completionDate: s.completionDate ? new Date(s.completionDate) : null,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          })),
        });
      }

      // Daybooks (Expenses)
      if (backupData.dayBooks?.length) {
        await tx.dayBook.createMany({
          data: backupData.dayBooks.map((d: any) => ({
            ...d,
            date: new Date(d.date),
            createdAt: new Date(d.createdAt),
            updatedAt: new Date(d.updatedAt),
          })),
        });
      }

      // Ledgers
      if (backupData.ledgers?.length) {
        await tx.ledger.createMany({
          data: backupData.ledgers.map((l: any) => ({
            ...l,
            createdAt: new Date(l.createdAt),
            updatedAt: new Date(l.updatedAt),
          })),
        });
      }

      // Ledger Transactions
      if (backupData.ledgerTransactions?.length) {
        await tx.ledgerTransaction.createMany({
          data: backupData.ledgerTransactions.map((lt: any) => ({
            ...lt,
            date: new Date(lt.date),
            createdAt: new Date(lt.createdAt),
          })),
        });
      }

      // Materials
      if (backupData.materials?.length) {
        await tx.material.createMany({
          data: backupData.materials.map((m: any) => ({
            ...m,
            createdAt: new Date(m.createdAt),
            updatedAt: new Date(m.updatedAt),
          })),
        });
      }

      // Material Transactions
      if (backupData.materialTransactions?.length) {
        await tx.materialTransaction.createMany({
          data: backupData.materialTransactions.map((mt: any) => ({
            ...mt,
            date: new Date(mt.date),
            createdAt: new Date(mt.createdAt),
          })),
        });
      }
    });

    res.json({
      success: true,
      message: 'Database restored to target snapshot successfully',
    });
  } catch (error: any) {
    console.error('Restore failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBackupLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const selectFolder = async (req: Request, res: Response): Promise<void> => {
  if (process.platform !== 'win32') {
    res.status(400).json({ 
      success: false, 
      message: 'Folder picker is only supported in Windows desktop mode.' 
    });
    return;
  }
  const { exec } = require('child_process');
  try {
    // PowerShell script to trigger FolderBrowserDialog
    const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select Target Backup Folder'; $f.ShowNewFolderButton = $true; [void]$f.ShowDialog(); $f.SelectedPath"`;

    exec(psCommand, (error: any, stdout: string, stderr: any) => {
      if (error) {
        console.error("PowerShell folder picker error:", error);
        res.status(500).json({ success: false, message: "Failed to open folder picker" });
        return;
      }
      
      const selectedPath = stdout.trim();
      res.json({ success: true, selectedPath: selectedPath || null });
    });
  } catch (error: any) {
    console.error("selectFolder error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
