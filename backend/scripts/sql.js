#!/usr/bin/env node
/**
 * sql.js - Simple SQL runner for MOBIUS Wiki
 *
 * Usage:
 *   node scripts/sql.js "SELECT * FROM wiki.pages LIMIT 5"
 *   node scripts/sql.js --file query.sql
 *   echo "SELECT 1" | node scripts/sql.js
 *   node scripts/sql.js --tables                    # List all tables
 *   node scripts/sql.js --describe wiki.pages       # Describe table
 *   node scripts/sql.js --count wiki.pages          # Count rows
 *
 * Options:
 *   --file, -f <path>     Read SQL from file
 *   --json                Output as JSON (default is table)
 *   --tables              List all tables in wiki schema
 *   --describe, -d <tbl>  Describe table structure
 *   --count, -c <tbl>     Count rows in table
 *   --quiet, -q           Suppress row count output
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env from backend directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobius_wiki'
});

// Parse arguments
const args = process.argv.slice(2);
let sql = null;
let outputJson = false;
let quiet = false;

async function main() {
  try {
    // Handle special flags
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--json') {
        outputJson = true;
      } else if (arg === '--quiet' || arg === '-q') {
        quiet = true;
      } else if (arg === '--tables') {
        sql = `SELECT tablename FROM pg_tables WHERE schemaname = 'wiki' ORDER BY tablename`;
      } else if (arg === '--describe' || arg === '-d') {
        const table = args[++i];
        if (!table) { console.error('--describe requires table name'); process.exit(1); }
        const [schema, tbl] = table.includes('.') ? table.split('.') : ['wiki', table];
        sql = `SELECT column_name, data_type, is_nullable, column_default
               FROM information_schema.columns
               WHERE table_schema = '${schema}' AND table_name = '${tbl}'
               ORDER BY ordinal_position`;
      } else if (arg === '--count' || arg === '-c') {
        const table = args[++i];
        if (!table) { console.error('--count requires table name'); process.exit(1); }
        const fullTable = table.includes('.') ? table : `wiki.${table}`;
        sql = `SELECT COUNT(*) as count FROM ${fullTable}`;
      } else if (arg === '--file' || arg === '-f') {
        const filePath = args[++i];
        if (!filePath) { console.error('--file requires path'); process.exit(1); }
        sql = fs.readFileSync(filePath, 'utf8');
      } else if (!arg.startsWith('-')) {
        sql = arg;
      }
    }

    // Read from stdin if no SQL provided and stdin is piped
    if (!sql && !process.stdin.isTTY) {
      sql = await readStdin();
    }

    if (!sql) {
      console.log(`Usage: node scripts/sql.js "SELECT * FROM wiki.pages"
       node scripts/sql.js --tables
       node scripts/sql.js --describe pages
       node scripts/sql.js --count pages
       node scripts/sql.js --file query.sql`);
      process.exit(0);
    }

    // Execute query
    const result = await pool.query(sql);

    // Output results
    if (result.rows && result.rows.length > 0) {
      if (outputJson) {
        console.log(JSON.stringify(result.rows, null, 2));
      } else {
        console.table(result.rows);
      }
      if (!quiet) {
        console.log(`\n${result.rows.length} row(s)`);
      }
    } else if (result.rowCount !== null) {
      console.log(`Query OK, ${result.rowCount} row(s) affected`);
    } else {
      console.log('Query executed successfully');
    }

  } catch (err) {
    console.error('Error:', err.message);
    if (err.position) {
      console.error('Position:', err.position);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

main();
