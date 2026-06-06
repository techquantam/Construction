import app from './app';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const PORT = process.env.PORT || 5000;
export const prisma = new PrismaClient({ adapter });

async function startServer() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL Database Connected Successfully.');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to database', error);
    process.exit(1);
  }
}

startServer();
