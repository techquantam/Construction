import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runRequest() {
  try {
    // 1. Get site and ledger from DB
    await prisma.$connect();
    const ledger = await prisma.ledger.findFirst({
      where: { name: { contains: 'RAGHVENDRA', mode: 'insensitive' } } // Look for Raghavendra Singh from screenshot
    }) || await prisma.ledger.findFirst();
    
    const site = await prisma.site.findFirst();

    if (!ledger || !site) {
      console.log("Could not find ledger or site in DB to test.");
      return;
    }

    console.log(`Testing with Ledger ID: ${ledger.id} (${ledger.name}), Site ID: ${site.id} (${site.name})`);

    // 2. Login to get token
    const loginRes = await fetch('http://localhost:5000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'password123'
      })
    });
    const loginData = await loginRes.json() as any;
    const token = loginData.data.token;
    console.log("Logged in successfully. Token obtained:", token ? "Token present" : "Token absent");

    // 3. Send DELETE request to /api/ledgers/:id/data?siteId=...
    console.log("Sending DELETE request...");
    const deleteRes = await fetch(`http://localhost:5000/api/ledgers/${ledger.id}/data?siteId=${site.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const deleteText = await deleteRes.text();
    console.log("API Response Status:", deleteRes.status);
    console.log("API Response Text:", deleteText.substring(0, 1000));

  } catch (error: any) {
    console.error("API Request Failed!");
    console.error(error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

runRequest();
