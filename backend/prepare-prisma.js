if (process.env.NODE_ENV !== "production") {
  try {
    require("dotenv").config();
  } catch (e) {}
}

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// Clean quotes if any from env var
const dbType = (process.env.DB_TYPE || '').replace(/"/g, '');

if (dbType !== 'sqlite') {
  schema = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, schema);
  console.log('Updated Prisma schema provider to postgresql based on DB_TYPE.');
} else {
  schema = schema.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
  fs.writeFileSync(schemaPath, schema);
  console.log('Using SQLite provider for Prisma.');
}
