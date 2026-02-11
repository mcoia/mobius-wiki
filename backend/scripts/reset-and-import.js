#!/usr/bin/env node
/**
 * reset-and-import.js
 *
 * Resets the database and imports clean production data from original sources.
 * This script orchestrates a complete fresh import, replacing any corrupted test data.
 *
 * Data Sources:
 * - Platform wikis (Site, Help, FAQ): SQL seed files
 * - BlueSpice content (FOLIO, EDS, OpenRS, Panorama): MediaWiki XML import
 * - MOBIUS Documentation: AsciiDoc git repo migration
 *
 * Usage:
 *   node scripts/reset-and-import.js               # Full reset and import
 *   node scripts/reset-and-import.js --dry-run     # Preview without changes
 *   node scripts/reset-and-import.js --skip-docs   # Skip MOBIUS Documentation import
 *   node scripts/reset-and-import.js --skip-xml    # Skip BlueSpice XML import
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { execSync, spawn } = require('child_process');
require('dotenv').config();

// =============================================================================
// Configuration
// =============================================================================

const SCRIPTS_DIR = __dirname;
const BACKEND_DIR = path.dirname(SCRIPTS_DIR);
const PROJECT_ROOT = path.dirname(BACKEND_DIR);

const config = {
  dryRun: false,
  skipDocs: false,
  skipXml: false,
  verbose: false,
};

// Parse CLI arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--dry-run':
    case '-n':
      config.dryRun = true;
      break;
    case '--skip-docs':
      config.skipDocs = true;
      break;
    case '--skip-xml':
      config.skipXml = true;
      break;
    case '--verbose':
    case '-v':
      config.verbose = true;
      break;
    case '--help':
    case '-h':
      showHelp();
      process.exit(0);
  }
}

function showHelp() {
  console.log(`
Reset and Import - Clean Production Data

Resets the database and imports fresh data from original sources.
This replaces corrupted test data with clean content.

Usage:
  node scripts/reset-and-import.js [options]

Options:
  --dry-run, -n     Preview what would happen without making changes
  --skip-docs       Skip MOBIUS Documentation import (from AsciiDoc repo)
  --skip-xml        Skip BlueSpice XML import (FOLIO, EDS, OpenRS, Panorama)
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Data Sources:
  Platform Wikis:    seeds/001_setup_data.sql (Site wiki)
                     seeds/003_help_wiki.sql (Help wiki)
                     seeds/004_faq_wiki.sql (FAQ wiki)

  BlueSpice Import:  resources/MOBIUS+Wiki-20260209222944.xml
                     Creates: FOLIO, EDS, OpenRS, Panorama wikis

  Documentation:     resources/docs/ (AsciiDoc git repository)
                     Creates: MOBIUS Documentation wiki

Expected Result (8 wikis):
  1. MOBIUS Documentation (docs) - from AsciiDoc
  2. FOLIO (folio) - from BlueSpice XML
  3. OpenRS (openrs) - from BlueSpice XML
  4. EDS (eds) - from BlueSpice XML
  5. Panorama (panorama) - from BlueSpice XML
  6. Help (help) - from SQL seed
  7. FAQ (faq) - from SQL seed
  8. Site (site) - from SQL seed

Examples:
  # Preview full reset
  node scripts/reset-and-import.js --dry-run

  # Full reset and import
  node scripts/reset-and-import.js

  # Reset with only platform wikis (no imported content)
  node scripts/reset-and-import.js --skip-docs --skip-xml
`);
}

// =============================================================================
// Database Connection
// =============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobius_wiki',
});

// =============================================================================
// Step Functions
// =============================================================================

/**
 * Step 1: Clear all data (preserves schema)
 */
async function clearAllData() {
  console.log('\n📋 Step 1: Clearing all data...');

  if (config.dryRun) {
    console.log('  [DRY RUN] Would delete all data from:');
    console.log('    - page_views, page_versions, page_tags, pages');
    console.log('    - file_links, files');
    console.log('    - sections, access_rules, wikis');
    console.log('    - tags, redirects');
    console.log('    - sessions');
    console.log('    - users, libraries');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete in correct order to respect foreign keys
    // Page-related data
    await client.query('DELETE FROM wiki.page_views');
    await client.query('DELETE FROM wiki.page_versions');
    await client.query('DELETE FROM wiki.page_tags');
    await client.query('DELETE FROM wiki.pages');
    console.log('  ✓ Cleared pages and page data');

    // File-related data
    await client.query('DELETE FROM wiki.file_links');
    await client.query('DELETE FROM wiki.files');
    console.log('  ✓ Cleared files');

    // Wiki structure
    await client.query('DELETE FROM wiki.sections');
    await client.query('DELETE FROM wiki.access_rules');
    await client.query('DELETE FROM wiki.wikis');
    console.log('  ✓ Cleared wikis and sections');

    // Other data
    await client.query('DELETE FROM wiki.tags');
    await client.query('DELETE FROM wiki.redirects');
    await client.query('DELETE FROM wiki.sessions');
    console.log('  ✓ Cleared tags, redirects, sessions');

    // Clear users and libraries (will be recreated by seed)
    await client.query('DELETE FROM wiki.users');
    await client.query('DELETE FROM wiki.libraries');
    console.log('  ✓ Cleared users and libraries');

    // Reset all sequences to 1 so seed data IDs work correctly
    const sequences = [
      'wiki.libraries_id_seq',
      'wiki.users_id_seq',
      'wiki.wikis_id_seq',
      'wiki.sections_id_seq',
      'wiki.pages_id_seq',
      'wiki.page_versions_id_seq',
      'wiki.tags_id_seq',
      'wiki.files_id_seq',
      'wiki.file_links_id_seq',
      'wiki.access_rules_id_seq',
      'wiki.redirects_id_seq',
      'wiki.page_views_id_seq',
    ];
    for (const seq of sequences) {
      await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
    }
    console.log('  ✓ Reset all sequences');

    await client.query('COMMIT');
    console.log('  ✓ Data cleared successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`Failed to clear data: ${err.message}`);
  } finally {
    client.release();
  }
}

/**
 * Step 2: Seed base data (libraries, core users)
 */
async function seedBaseData() {
  console.log('\n📋 Step 2: Seeding base data (libraries, users)...');

  if (config.dryRun) {
    console.log('  [DRY RUN] Would run: seeds/001_setup_data.sql');
    console.log('    - Creates libraries');
    console.log('    - Creates core users (admin, librarian, staff)');
    console.log('    - Creates Site wiki with platform pages');
    return;
  }

  const seedFile = path.join(BACKEND_DIR, 'seeds', '001_setup_data.sql');
  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed file not found: ${seedFile}`);
  }

  const sql = fs.readFileSync(seedFile, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('  ✓ Base data seeded (libraries, users, Site wiki)');
  } finally {
    client.release();
  }
}

/**
 * Step 3: Seed Help wiki
 */
async function seedHelpWiki() {
  console.log('\n📋 Step 3: Seeding Help wiki...');

  if (config.dryRun) {
    console.log('  [DRY RUN] Would run: seeds/003_help_wiki.sql');
    console.log('    - Creates Help wiki');
    console.log('    - Creates 7 sections');
    console.log('    - Creates 23 help pages');
    return;
  }

  const seedFile = path.join(BACKEND_DIR, 'seeds', '003_help_wiki.sql');
  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed file not found: ${seedFile}`);
  }

  const sql = fs.readFileSync(seedFile, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('  ✓ Help wiki seeded (7 sections, 23 pages)');
  } finally {
    client.release();
  }
}

/**
 * Step 4: Seed FAQ wiki
 */
async function seedFaqWiki() {
  console.log('\n📋 Step 4: Seeding FAQ wiki...');

  if (config.dryRun) {
    console.log('  [DRY RUN] Would run: seeds/004_faq_wiki.sql');
    console.log('    - Creates FAQ wiki');
    console.log('    - Creates 4 sections');
    console.log('    - Creates 13 FAQ pages');
    return;
  }

  const seedFile = path.join(BACKEND_DIR, 'seeds', '004_faq_wiki.sql');
  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed file not found: ${seedFile}`);
  }

  const sql = fs.readFileSync(seedFile, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('  ✓ FAQ wiki seeded (4 sections, 13 pages)');
  } finally {
    client.release();
  }
}

/**
 * Step 5: Import BlueSpice content (FOLIO, EDS, OpenRS, Panorama)
 */
async function importBlueSpiceContent() {
  console.log('\n📋 Step 5: Importing BlueSpice content...');

  if (config.skipXml) {
    console.log('  [SKIPPED] BlueSpice import disabled via --skip-xml');
    return;
  }

  const xmlFile = path.join(PROJECT_ROOT, 'resources', 'MOBIUS+Wiki-20260209222944.xml');
  if (!fs.existsSync(xmlFile)) {
    console.log(`  ⚠ XML file not found: ${xmlFile}`);
    console.log('    Skipping BlueSpice import');
    return;
  }

  if (config.dryRun) {
    console.log('  [DRY RUN] Would run import-mediawiki.js with:');
    console.log(`    --file ${xmlFile}`);
    console.log('    Creates: FOLIO, EDS, OpenRS, Panorama wikis');
    return;
  }

  console.log('  Importing from BlueSpice XML...');
  console.log(`  Source: ${xmlFile}`);

  try {
    const result = execSync(
      `node "${path.join(SCRIPTS_DIR, 'import-mediawiki.js')}" --file "${xmlFile}"`,
      {
        cwd: BACKEND_DIR,
        stdio: config.verbose ? 'inherit' : 'pipe',
        encoding: 'utf8',
      }
    );

    if (!config.verbose && result) {
      // Parse output for summary
      const lines = result.split('\n');
      const summaryStart = lines.findIndex(l => l.includes('MULTI-WIKI IMPORT COMPLETE'));
      if (summaryStart >= 0) {
        lines.slice(summaryStart).forEach(l => {
          if (l.trim()) console.log(`    ${l}`);
        });
      }
    }

    console.log('  ✓ BlueSpice content imported (FOLIO, EDS, OpenRS, Panorama)');
  } catch (err) {
    throw new Error(`BlueSpice import failed: ${err.message}`);
  }
}

/**
 * Step 6: Import MOBIUS Documentation (from AsciiDoc git repo)
 */
async function importMobiusDocumentation() {
  console.log('\n📋 Step 6: Importing MOBIUS Documentation...');

  if (config.skipDocs) {
    console.log('  [SKIPPED] Documentation import disabled via --skip-docs');
    return;
  }

  const docsDir = path.join(PROJECT_ROOT, 'resources', 'docs');
  if (!fs.existsSync(docsDir)) {
    console.log(`  ⚠ Docs directory not found: ${docsDir}`);
    console.log('    Skipping documentation import');
    return;
  }

  if (config.dryRun) {
    console.log('  [DRY RUN] Would run migrate-docs.js');
    console.log(`    Source: ${docsDir}`);
    console.log('    Creates: MOBIUS Documentation wiki with version history');
    return;
  }

  console.log('  Importing from AsciiDoc repository...');
  console.log(`  Source: ${docsDir}`);

  try {
    const result = execSync(
      `node "${path.join(SCRIPTS_DIR, 'migrate-docs.js')}"`,
      {
        cwd: BACKEND_DIR,
        stdio: config.verbose ? 'inherit' : 'pipe',
        encoding: 'utf8',
      }
    );

    if (!config.verbose && result) {
      // Parse output for summary
      const lines = result.split('\n');
      const summaryStart = lines.findIndex(l => l.includes('Migration Summary'));
      if (summaryStart >= 0) {
        lines.slice(summaryStart).forEach(l => {
          if (l.trim()) console.log(`    ${l}`);
        });
      }
    }

    console.log('  ✓ MOBIUS Documentation imported with version history');
  } catch (err) {
    throw new Error(`Documentation import failed: ${err.message}`);
  }
}

/**
 * Step 7: Import documentation images
 */
async function importDocsImages() {
  console.log('\n📋 Step 7: Importing documentation images...');

  if (config.skipDocs) {
    console.log('  [SKIPPED] Docs image import disabled via --skip-docs');
    return;
  }

  const importScript = path.join(SCRIPTS_DIR, 'import-docs-images.js');
  if (!fs.existsSync(importScript)) {
    console.log('  ⚠ import-docs-images.js not found, skipping');
    return;
  }

  if (config.dryRun) {
    console.log('  [DRY RUN] Would run import-docs-images.js');
    console.log('    Imports images from resources/docs/ into the database');
    return;
  }

  try {
    execSync(
      `node "${importScript}"`,
      {
        cwd: BACKEND_DIR,
        stdio: config.verbose ? 'inherit' : 'pipe',
        encoding: 'utf8',
      }
    );
    console.log('  ✓ Documentation images imported');
  } catch (err) {
    console.log(`  ⚠ Image import warning: ${err.message}`);
  }
}

/**
 * Step 8: Reset sequences
 */
async function resetSequences() {
  console.log('\n📋 Step 8: Resetting database sequences...');

  if (config.dryRun) {
    console.log('  [DRY RUN] Would reset sequences for all tables');
    return;
  }

  const client = await pool.connect();
  try {
    // Reset all sequences to their max values
    const sequences = [
      { seq: 'wiki.libraries_id_seq', table: 'wiki.libraries' },
      { seq: 'wiki.users_id_seq', table: 'wiki.users' },
      { seq: 'wiki.wikis_id_seq', table: 'wiki.wikis' },
      { seq: 'wiki.sections_id_seq', table: 'wiki.sections' },
      { seq: 'wiki.pages_id_seq', table: 'wiki.pages' },
      { seq: 'wiki.page_versions_id_seq', table: 'wiki.page_versions' },
      { seq: 'wiki.tags_id_seq', table: 'wiki.tags' },
      { seq: 'wiki.files_id_seq', table: 'wiki.files' },
      { seq: 'wiki.access_rules_id_seq', table: 'wiki.access_rules' },
      { seq: 'wiki.redirects_id_seq', table: 'wiki.redirects' },
    ];

    for (const { seq, table } of sequences) {
      await client.query(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
    }

    console.log('  ✓ All sequences reset');
  } finally {
    client.release();
  }
}

/**
 * Step 9: Show summary
 */
async function showSummary() {
  console.log('\n📋 Step 9: Verification...');

  if (config.dryRun) {
    console.log('  [DRY RUN] Would show wiki counts');
    return;
  }

  const client = await pool.connect();
  try {
    // Count wikis
    const { rows: wikis } = await client.query(`
      SELECT w.slug, w.title, COUNT(DISTINCT s.id) as sections, COUNT(DISTINCT p.id) as pages
      FROM wiki.wikis w
      LEFT JOIN wiki.sections s ON s.wiki_id = w.id AND s.deleted_at IS NULL
      LEFT JOIN wiki.pages p ON p.section_id = s.id AND p.deleted_at IS NULL
      WHERE w.deleted_at IS NULL
      GROUP BY w.id, w.slug, w.title
      ORDER BY w.id
    `);

    console.log('\n' + '='.repeat(70));
    console.log('RESET AND IMPORT COMPLETE');
    console.log('='.repeat(70));

    console.log('\nWikis created:');
    console.log('─'.repeat(50));
    console.log(`${'Slug'.padEnd(15)} ${'Title'.padEnd(25)} ${'Sections'.padStart(8)} ${'Pages'.padStart(8)}`);
    console.log('─'.repeat(50));

    let totalSections = 0;
    let totalPages = 0;

    for (const wiki of wikis) {
      console.log(`${wiki.slug.padEnd(15)} ${wiki.title.substring(0, 24).padEnd(25)} ${wiki.sections.toString().padStart(8)} ${wiki.pages.toString().padStart(8)}`);
      totalSections += parseInt(wiki.sections);
      totalPages += parseInt(wiki.pages);
    }

    console.log('─'.repeat(50));
    console.log(`${'TOTAL'.padEnd(15)} ${wikis.length.toString() + ' wikis'.padEnd(25)} ${totalSections.toString().padStart(8)} ${totalPages.toString().padStart(8)}`);
    console.log('');

    // Verify login
    const { rows: admin } = await client.query(`
      SELECT email FROM wiki.users WHERE id = 1
    `);
    if (admin.length > 0) {
      console.log('Login credentials:');
      console.log(`  Email: ${admin[0].email}`);
      console.log('  Password: admin123');
    }

    console.log('\n' + '='.repeat(70));
  } finally {
    client.release();
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('MOBIUS Wiki - Reset and Import Clean Data');
  console.log('='.repeat(70));

  if (config.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  const startTime = Date.now();

  try {
    // Test database connection
    console.log('Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✓ Database connected');

    // Run all steps
    await clearAllData();
    await seedBaseData();
    await seedHelpWiki();
    await seedFaqWiki();
    await importBlueSpiceContent();
    await importMobiusDocumentation();
    await importDocsImages();
    await resetSequences();
    await showSummary();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nCompleted in ${elapsed}s`);

    if (config.dryRun) {
      console.log('\nTo execute, run without --dry-run:');
      console.log('  npm run db:reset:clean');
    }

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    if (config.verbose) {
      console.error(err.stack);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
