const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const connectionString = process.env.DATABASE_URL;
console.log("Connecting to database URL:", connectionString);

const client = new Client({ connectionString });

async function run() {
  await client.connect();
  console.log("Connected successfully!");
  
  const res = await client.query('SELECT COUNT(*) FROM "DayBook"');
  console.log("DayBook entries count (SQL):", res.rows[0].count);
  
  const resMaxDate = await client.query('SELECT MAX(date) FROM "DayBook"');
  console.log("Latest DayBook date (SQL):", resMaxDate.rows[0].max);

  const resSample = await client.query('SELECT date, "expenseType", amount FROM "DayBook" ORDER BY date DESC LIMIT 5');
  console.log("Latest 5 entries in database:");
  console.log(resSample.rows);

  await client.end();
}

run().catch(err => {
  console.error("Database query failed:", err.message);
  process.exit(1);
});
