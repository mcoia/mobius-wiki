#!/usr/bin/env node
/**
 * db-snapshot.js - Database snapshot/restore tool for MOBIUS Wiki
 *
 * Save and restore database state for testing destructive changes.
 * Snapshots are stored as SQL dump files in backend/snapshots/
 *
 * Usage:
 *   node scripts/db-snapshot.js save [name]       # Save snapshot (default: timestamp)
 *   node scripts/db-snapshot.js restore <name>    # Restore snapshot
 *   node scripts/db-snapshot.js list              # List all snapshots
 *   node scripts/db-snapshot.js delete <name>     # Delete a snapshot
 *   node scripts/db-snapshot.js info <name>       # Show snapshot details
 *
 * Examples:
 *   npm run db:snapshot save before-migration
 *   npm run db:snapshot restore before-migration
 *   npm run db:snapshot list
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const SNAPSHOT_DIR = path.join(__dirname, '..', 'snapshots');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobius_wiki'
});

// Ensure snapshots directory exists
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

const args = process.argv.slice(2);
const command = args[0];
const snapshotName = args[1];

async function main() {
  try {
    switch (command) {
      case 'save':
        await saveSnapshot(snapshotName);
        break;
      case 'restore':
        if (!snapshotName) {
          console.error('Error: restore requires a snapshot name');
          console.log('Usage: node scripts/db-snapshot.js restore <name>');
          process.exit(1);
        }
        await restoreSnapshot(snapshotName);
        break;
      case 'list':
        listSnapshots();
        break;
      case 'delete':
        if (!snapshotName) {
          console.error('Error: delete requires a snapshot name');
          process.exit(1);
        }
        deleteSnapshot(snapshotName);
        break;
      case 'info':
        if (!snapshotName) {
          console.error('Error: info requires a snapshot name');
          process.exit(1);
        }
        showSnapshotInfo(snapshotName);
        break;
      default:
        console.log(`Database Snapshot Tool

Usage:
  npm run db:snapshot save [name]       Save current database state
  npm run db:snapshot restore <name>    Restore a saved snapshot
  npm run db:snapshot list              List all snapshots
  npm run db:snapshot delete <name>     Delete a snapshot
  npm run db:snapshot info <name>       Show snapshot details
`);
    }
  } finally {
    await pool.end();
  }
}

async function saveSnapshot(name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const snapshotName = name || timestamp;
  const filePath = path.join(SNAPSHOT_DIR, `${snapshotName}.json`);

  if (fs.existsSync(filePath)) {
    console.error(`Error: Snapshot '${snapshotName}' already exists`);
    process.exit(1);
  }

  console.log(`Saving snapshot '${snapshotName}'...`);

  // Get all tables in wiki schema
  const tablesResult = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'wiki'
    ORDER BY tablename
  `);

  const snapshot = {
    name: snapshotName,
    created: new Date().toISOString(),
    tables: {}
  };

  for (const row of tablesResult.rows) {
    const table = row.tablename;
    const dataResult = await pool.query(`SELECT * FROM wiki.${table}`);
    snapshot.tables[table] = {
      count: dataResult.rows.length,
      data: dataResult.rows
    };
    console.log(`  ${table}: ${dataResult.rows.length} rows`);
  }

  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot saved to: ${filePath}`);
}

async function restoreSnapshot(name) {
  const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: Snapshot '${name}' not found`);
    listSnapshots();
    process.exit(1);
  }

  console.log(`Restoring snapshot '${name}'...`);
  const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Order matters for foreign keys - delete in reverse dependency order
  const deleteOrder = [
    'page_views', 'page_tags', 'page_versions', 'file_links',
    'access_rules', 'redirects', 'sessions', 'pages', 'sections',
    'files', 'tags', 'wikis', 'users', 'libraries'
  ];

  // Insert in forward dependency order
  const insertOrder = [
    'libraries', 'users', 'wikis', 'tags', 'files', 'sections',
    'pages', 'page_versions', 'page_tags', 'page_views',
    'file_links', 'access_rules', 'redirects', 'sessions'
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Disable triggers temporarily
    await client.query('SET session_replication_role = replica');

    // Delete all data
    console.log('\nClearing existing data...');
    for (const table of deleteOrder) {
      if (snapshot.tables[table]) {
        await client.query(`DELETE FROM wiki.${table}`);
      }
    }

    // Insert snapshot data
    console.log('\nRestoring data...');
    for (const table of insertOrder) {
      const tableData = snapshot.tables[table];
      if (!tableData || tableData.data.length === 0) continue;

      const columns = Object.keys(tableData.data[0]);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const insertSql = `INSERT INTO wiki.${table} (${columns.join(', ')}) VALUES (${placeholders})`;

      for (const row of tableData.data) {
        const values = columns.map(col => row[col]);
        await client.query(insertSql, values);
      }
      console.log(`  ${table}: ${tableData.data.length} rows`);
    }

    // Reset sequences
    console.log('\nResetting sequences...');
    const seqTables = ['libraries', 'users', 'wikis', 'sections', 'pages', 'files', 'tags'];
    for (const table of seqTables) {
      await client.query(`
        SELECT setval('wiki.${table}_id_seq', COALESCE((SELECT MAX(id) FROM wiki.${table}), 1))
      `);
    }

    // Re-enable triggers
    await client.query('SET session_replication_role = DEFAULT');

    await client.query('COMMIT');
    console.log(`\nSnapshot '${name}' restored successfully!`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function listSnapshots() {
  const files = fs.readdirSync(SNAPSHOT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(SNAPSHOT_DIR, f);
      const stats = fs.statSync(filePath);
      const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const totalRows = Object.values(snapshot.tables).reduce((sum, t) => sum + t.count, 0);
      return {
        name: f.replace('.json', ''),
        created: snapshot.created,
        tables: Object.keys(snapshot.tables).length,
        rows: totalRows,
        size: `${(stats.size / 1024).toFixed(1)} KB`
      };
    });

  if (files.length === 0) {
    console.log('No snapshots found. Create one with: npm run db:snapshot save [name]');
    return;
  }

  console.log('Available snapshots:\n');
  console.table(files);
}

function deleteSnapshot(name) {
  const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: Snapshot '${name}' not found`);
    process.exit(1);
  }

  fs.unlinkSync(filePath);
  console.log(`Snapshot '${name}' deleted`);
}

function showSnapshotInfo(name) {
  const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: Snapshot '${name}' not found`);
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const stats = fs.statSync(filePath);

  console.log(`Snapshot: ${name}`);
  console.log(`Created: ${snapshot.created}`);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log('\nTables:');

  const tableInfo = Object.entries(snapshot.tables).map(([name, data]) => ({
    table: name,
    rows: data.count
  }));
  console.table(tableInfo);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
