import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backup test...");
  try {
    const admins = await prisma.admin.findMany();
    console.log(`Successfully fetched ${admins.length} admins.`);
    
    // Save to file
    fs.writeFileSync('./scratch/backup_data.json', JSON.stringify(admins, null, 2));
    console.log("Data saved to scratch/backup_data.json");
    
    // If Admin works, let's try others
    const sites = await prisma.site.findMany();
    console.log(`Successfully fetched ${sites.length} sites.`);
    
    console.log("Backup test SUCCESSFUL. Read access is allowed.");
  } catch (error) {
    console.error("Backup test FAILED:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
