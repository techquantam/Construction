import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("DATABASE_URL is:", process.env.DATABASE_URL);
  console.log("Trying to query sites...");
  try {
    const sites = await prisma.site.findMany();
    console.log("Successfully fetched sites. Count:", sites.length);
    console.log("First few sites:", sites.slice(0, 3));
    
    console.log("Trying to create a test site...");
    const newSite = await prisma.site.create({
      data: {
        name: "TEST_SITE_" + Date.now(),
        clientName: "DIRECT CLIENT",
        address: "",
        budget: 0,
        status: "RUNNING",
        startDate: new Date(),
      }
    });
    console.log("Successfully created test site:", newSite);
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
