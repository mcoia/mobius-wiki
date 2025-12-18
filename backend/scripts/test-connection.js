require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...\n');
    console.log('Configuration:');
    console.log(`  Host: ${process.env.DATABASE_HOST}`);
    console.log(`  Port: ${process.env.DATABASE_PORT}`);
    console.log(`  Database: ${process.env.DATABASE_NAME}`);
    console.log(`  User: ${process.env.DATABASE_USER}\n`);

    // Test connection
    const client = await pool.connect();
    console.log('✅ Connection successful!\n');

    // Get database version
    const versionResult = await client.query('SELECT version()');
    console.log('PostgreSQL Version:');
    console.log(`  ${versionResult.rows[0].version}\n`);

    // Count tables
    const tablesResult = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'wiki'
    `);
    console.log(`Tables in database: ${tablesResult.rows[0].table_count}\n`);

    // List all tables
    const tableListResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'wiki'
      ORDER BY table_name
    `);

    if (tableListResult.rows.length > 0) {
      console.log('Tables:');
      tableListResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('No tables found. Run migrations to create schema.');
    }

    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:');
    console.error(`  ${error.message}\n`);
    console.error('Please check your .env file and ensure PostgreSQL is running.');
    process.exit(1);
  }
}

testConnection();
