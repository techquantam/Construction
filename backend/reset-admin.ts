import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const newPassword = 'password123';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  try {
    await prisma.$connect();
    
    const admin = await prisma.admin.findFirst();
    if (admin) {
      await prisma.admin.update({
        where: { id: admin.id },
        data: { password: hashedPassword }
      });
      console.log(`Admin password has been reset successfully to: ${newPassword}`);
    } else {
      await prisma.admin.create({
        data: {
          username: 'admin',
          email: 'admin@example.com',
          password: hashedPassword
        }
      });
      console.log(`No admin found. Created a new Admin account with username: admin and password: ${newPassword}`);
    }
  } catch (error) {
    console.error('Error resetting admin password:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
