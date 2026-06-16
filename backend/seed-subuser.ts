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
  try {
    await prisma.$connect();
    console.log('Connected to database.');

    // 1. Get the first site
    const site = await prisma.site.findFirst();
    if (!site) {
      console.error('No sites found. Please create a site first.');
      return;
    }
    console.log(`Using site: ${site.name} (${site.id})`);

    // 2. Ensure "OM NAMAH SHIVAY" ledger exists
    let ledger = await prisma.ledger.findFirst({
      where: {
        name: {
          equals: 'OM NAMAH SHIVAY',
          mode: 'insensitive'
        }
      }
    });

    if (!ledger) {
      ledger = await prisma.ledger.create({
        data: {
          type: 'Company',
          name: 'OM NAMAH SHIVAY',
          contactPerson: JSON.stringify({
            address: 'LUCKNOW',
            mobileNo: '9999999999',
            customerExtra: 'CUSTOMER',
            measurementType: 'OTHER',
            plotUnit: 'BAGS'
          }),
          phone: '9999999999',
          outstandingBalance: 0,
          siteId: site.id
        }
      });
      console.log(`Created ledger "OM NAMAH SHIVAY" with ID: ${ledger.id}`);
    } else {
      console.log(`Ledger "OM NAMAH SHIVAY" already exists with ID: ${ledger.id}`);
    }

    // 3. Create or update sub-user "prabhakar"
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('pr12345', salt);

    const subUser = await prisma.admin.findUnique({
      where: { username: 'prabhakar' }
    });

    if (subUser) {
      await prisma.admin.update({
        where: { id: subUser.id },
        data: {
          password: hashedPassword,
          role: 'PRINTER',
          allowedLedgerId: ledger.id
        }
      });
      console.log(`Updated sub-user "prabhakar" password, role, and allowedLedgerId: ${ledger.id}`);
    } else {
      await prisma.admin.create({
        data: {
          username: 'prabhakar',
          email: 'prabhakar@example.com',
          password: hashedPassword,
          role: 'PRINTER',
          allowedLedgerId: ledger.id
        }
      });
      console.log(`Created sub-user "prabhakar" with password "pr12345" and allowedLedgerId: ${ledger.id}`);
    }

    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
