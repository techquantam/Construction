import { Pool } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
  console.log("Starting backup using pg...");
  try {
    const client = await pool.connect();
    console.log("Connected to database successfully.");

    // Test a simple query
    const res = await client.query('SELECT * FROM "Admin"');
    console.log(`Successfully fetched ${res.rows.length} rows from Admin table.`);

    const res2 = await client.query('SELECT * FROM "Site"');
    console.log(`Successfully fetched ${res2.rows.length} rows from Site table.`);
    
    fs.writeFileSync('./scratch/backup_admin.json', JSON.stringify(res.rows, null, 2));
    console.log("Saved Admin data to scratch/backup_admin.json");

    client.release();
    console.log("Database read access is WORKING. We can proceed to dump everything if needed.");
  } catch (error) {
    console.error("Backup test FAILED:", error);
    console.error("If the error is about quotas or limits, the Neon project is completely blocked.");
  } finally {
    await pool.end();
  }
}

main();
