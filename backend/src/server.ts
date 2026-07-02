import app from './app';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

dotenv.config();

const PORT = process.env.PORT || 5000;

export let prisma: PrismaClient;

if (process.env.DB_TYPE === 'sqlite') {
  const url = process.env.DATABASE_URL || 'file:./database.db';
  const adapter = new PrismaBetterSqlite3({ url });
  prisma = new PrismaClient({ adapter });
} else {
  const connectionString = `${process.env.DATABASE_URL}`;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
}

async function startServer() {
  try {
    await prisma.$connect();
    console.log(`${process.env.DB_TYPE === 'sqlite' ? 'SQLite' : 'PostgreSQL'} Database Connected Successfully.`);
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to database', error);
    process.exit(1);
  }
}

startServer();
