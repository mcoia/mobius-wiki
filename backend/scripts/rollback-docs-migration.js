#!/usr/bin/env node
/**
 * rollback-docs-migration.js
 *
 * Removes all data created by the documentation migration.
 * Use this if you need to start fresh or undo the migration.
 *
 * Usage:
 *   node scripts/rollback-docs-migration.js
 *   node scripts/rollback-docs-migration.js --dry-run
 *   node scripts/rollback-docs-migration.js --include-users  # Also delete migrated users
 *   node scripts/rollback-docs-migration.js --include-files  # Also delete imported files
 */

require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');

const WIKI_SLUG = 'mobius-documentation';
const UPLOADS_DIR = path.join(__dirname, '../uploads/docs-migration');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const includeUsers = args.includes('--include-users');
  const includeFiles = args.includes('--include-files');

  console.log('=== MOBIUS Documentation Migration Rollback ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Include users: ${includeUsers}`);
  console.log(`Include files: ${includeFiles}`);
  console.log();

  if (!dryRun) {
    console.log('WARNING: This will permanently delete all migrated documentation!');
    console.log('Press Ctrl+C within 5 seconds to cancel...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobius_wiki'
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('Database connected\n');

    // Find the wiki
    const { rows: wikiRows } = await pool.query(
      'SELECT id FROM wiki.wikis WHERE slug = $1',
      [WIKI_SLUG]
    );

    if (wikiRows.length === 0) {
      console.log(`Wiki "${WIKI_SLUG}" not found. Nothing to rollback.`);
      return;
    }

    const wikiId = wikiRows[0].id;
    console.log(`Found wiki ID: ${wikiId}\n`);

    // Get counts before deletion
    const counts = await getCounts(pool, wikiId);
    console.log('Current state:');
    console.log(`  Sections: ${counts.sections}`);
    console.log(`  Pages: ${counts.pages}`);
    console.log(`  Page versions: ${counts.versions}`);
    console.log(`  Access rules: ${counts.accessRules}`);
    console.log(`  File links: ${counts.fileLinks}`);
    if (includeFiles) console.log(`  Files: ${counts.files}`);
    console.log();

    if (dryRun) {
      console.log('DRY RUN - No changes made');
      return;
    }

    // Start deletion in correct order (respecting foreign keys)
    console.log('Deleting data...');

    // 1. Delete file links for pages in this wiki
    const { rowCount: fileLinksDeleted } = await pool.query(`
      DELETE FROM wiki.file_links
      WHERE linkable_type = 'page'
        AND linkable_id IN (
          SELECT p.id FROM wiki.pages p
          JOIN wiki.sections s ON p.section_id = s.id
          WHERE s.wiki_id = $1
        )
    `, [wikiId]);
    console.log(`  Deleted ${fileLinksDeleted} file links`);

    // 2. Delete page versions
    const { rowCount: versionsDeleted } = await pool.query(`
      DELETE FROM wiki.page_versions
      WHERE page_id IN (
        SELECT p.id FROM wiki.pages p
        JOIN wiki.sections s ON p.section_id = s.id
        WHERE s.wiki_id = $1
      )
    `, [wikiId]);
    console.log(`  Deleted ${versionsDeleted} page versions`);

    // 3. Delete page tags
    const { rowCount: tagsDeleted } = await pool.query(`
      DELETE FROM wiki.page_tags
      WHERE page_id IN (
        SELECT p.id FROM wiki.pages p
        JOIN wiki.sections s ON p.section_id = s.id
        WHERE s.wiki_id = $1
      )
    `, [wikiId]);
    console.log(`  Deleted ${tagsDeleted} page tags`);

    // 4. Delete pages
    const { rowCount: pagesDeleted } = await pool.query(`
      DELETE FROM wiki.pages
      WHERE section_id IN (
        SELECT id FROM wiki.sections WHERE wiki_id = $1
      )
    `, [wikiId]);
    console.log(`  Deleted ${pagesDeleted} pages`);

    // 5. Delete sections
    const { rowCount: sectionsDeleted } = await pool.query(`
      DELETE FROM wiki.sections WHERE wiki_id = $1
    `, [wikiId]);
    console.log(`  Deleted ${sectionsDeleted} sections`);

    // 6. Delete access rules
    const { rowCount: rulesDeleted } = await pool.query(`
      DELETE FROM wiki.access_rules
      WHERE ruleable_type = 'wiki' AND ruleable_id = $1
    `, [wikiId]);
    console.log(`  Deleted ${rulesDeleted} access rules`);

    // 7. Delete wiki
    await pool.query('DELETE FROM wiki.wikis WHERE id = $1', [wikiId]);
    console.log(`  Deleted wiki`);

    // Optional: Delete imported files
    if (includeFiles) {
      console.log('\nDeleting imported files...');

      // Get files to delete
      const { rows: files } = await pool.query(`
        SELECT id, storage_path FROM wiki.files
        WHERE storage_path LIKE 'uploads/docs-migration/%'
      `);

      // Delete from database
      const { rowCount: filesDeleted } = await pool.query(`
        DELETE FROM wiki.files
        WHERE storage_path LIKE 'uploads/docs-migration/%'
      `);
      console.log(`  Deleted ${filesDeleted} file records`);

      // Delete actual files
      let filesPurged = 0;
      for (const file of files) {
        try {
          const filePath = path.join(__dirname, '..', file.storage_path);
          await fs.unlink(filePath);
          filesPurged++;
        } catch (err) {
          // File might not exist
        }
      }
      console.log(`  Purged ${filesPurged} files from disk`);

      // Try to remove the directory
      try {
        await fs.rmdir(UPLOADS_DIR);
        console.log(`  Removed uploads directory`);
      } catch (err) {
        // Directory might not be empty or not exist
      }
    }

    // Optional: Delete migrated users
    if (includeUsers) {
      console.log('\nDeleting migrated users...');

      // Only delete users with @mobiusconsortium.org email that aren't admin
      const { rowCount: usersDeleted } = await pool.query(`
        DELETE FROM wiki.users
        WHERE email LIKE '%@mobiusconsortium.org'
          AND email != 'admin@mobius.org'
          AND role = 'mobius_staff'
      `);
      console.log(`  Deleted ${usersDeleted} users`);
    }

    // Clean up checkpoint file
    const checkpointFile = path.join(__dirname, '../migration-data/.migrate-checkpoint.json');
    try {
      await fs.unlink(checkpointFile);
      console.log('\nRemoved checkpoint file');
    } catch {
      // Checkpoint might not exist
    }

    console.log('\n=== Rollback Complete ===');

  } finally {
    await pool.end();
  }
}

/**
 * Get current counts for reporting
 */
async function getCounts(pool, wikiId) {
  const [sections, pages, versions, accessRules, fileLinks, files] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM wiki.sections WHERE wiki_id = $1', [wikiId]),
    pool.query(`
      SELECT COUNT(*) FROM wiki.pages p
      JOIN wiki.sections s ON p.section_id = s.id
      WHERE s.wiki_id = $1
    `, [wikiId]),
    pool.query(`
      SELECT COUNT(*) FROM wiki.page_versions v
      JOIN wiki.pages p ON v.page_id = p.id
      JOIN wiki.sections s ON p.section_id = s.id
      WHERE s.wiki_id = $1
    `, [wikiId]),
    pool.query(`
      SELECT COUNT(*) FROM wiki.access_rules
      WHERE ruleable_type = 'wiki' AND ruleable_id = $1
    `, [wikiId]),
    pool.query(`
      SELECT COUNT(*) FROM wiki.file_links
      WHERE linkable_type = 'page'
        AND linkable_id IN (
          SELECT p.id FROM wiki.pages p
          JOIN wiki.sections s ON p.section_id = s.id
          WHERE s.wiki_id = $1
        )
    `, [wikiId]),
    pool.query(`
      SELECT COUNT(*) FROM wiki.files
      WHERE storage_path LIKE 'uploads/docs-migration/%'
    `)
  ]);

  return {
    sections: parseInt(sections.rows[0].count),
    pages: parseInt(pages.rows[0].count),
    versions: parseInt(versions.rows[0].count),
    accessRules: parseInt(accessRules.rows[0].count),
    fileLinks: parseInt(fileLinks.rows[0].count),
    files: parseInt(files.rows[0].count)
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
