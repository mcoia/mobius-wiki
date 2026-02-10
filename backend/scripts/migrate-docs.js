#!/usr/bin/env node
/**
 * migrate-docs.js
 *
 * Main migration script that imports AsciiDoc documentation from resources/docs/
 * into the MOBIUS Wiki database, preserving git history as page versions.
 *
 * Usage:
 *   node scripts/migrate-docs.js                    # Full migration
 *   node scripts/migrate-docs.js --dry-run          # Preview without changes
 *   node scripts/migrate-docs.js --file <path>      # Migrate single file
 *   node scripts/migrate-docs.js --resume           # Resume from checkpoint
 *   node scripts/migrate-docs.js --skip-images      # Skip image placeholder handling
 */

require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');

const { createGitInstance, getFileHistory, getFileAtCommit, isValidRepo } = require('./lib/git-history-walker');
const { normalizeAuthor } = require('./lib/author-normalizer');
const { convertToHtml, extractTitle, generateSlug } = require('./lib/asciidoc-converter');

// Paths
const DOCS_ROOT = path.join(__dirname, '../../resources/docs');
const MODULES_PATH = path.join(DOCS_ROOT, 'base_docs/docs/modules');
const CHECKPOINT_FILE = path.join(__dirname, '../migration-data/.migrate-checkpoint.json');
const REPORT_FILE = path.join(__dirname, '../migration-data/migration-report.json');

// Flat section configuration with unique sort_order values
// Each section is independent (no parent, depth=0)
const FLAT_SECTIONS = {
  'IT - Policies': { slug: 'it-policies', description: 'IT department policies', sortOrder: 0 },
  'IT - Procedures': { slug: 'it-procedures', description: 'IT department procedures', sortOrder: 1 },
  'Helpdesk - Policies': { slug: 'helpdesk-policies', description: 'Helpdesk policies', sortOrder: 2 },
  'Helpdesk - Procedures': { slug: 'helpdesk-procedures', description: 'Helpdesk procedures', sortOrder: 3 },
  'eResources - Policies': { slug: 'eresources-policies', description: 'eResources policies', sortOrder: 4 },
  'eResources - Procedures': { slug: 'eresources-procedures', description: 'eResources procedures', sortOrder: 5 },
  'General': { slug: 'general', description: 'General documentation', sortOrder: 6 },
};

// Module to section mapping
// Maps AsciiDoc module names to flat section names
const MODULE_MAP = {
  'ROOT': { section: 'General' },
  'procedures_Helpdesk': { section: 'Helpdesk - Procedures' },
  'procedures_IT': { section: 'IT - Procedures' },
  'policies_Helpdesk': { section: 'Helpdesk - Policies' },
  'policies_IT': { section: 'IT - Policies' },
  'policies_eResources': { section: 'eResources - Policies' },
  'procedures_eResources': { section: 'eResources - Procedures' },
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const resume = args.includes('--resume');
  const skipImages = args.includes('--skip-images');
  const singleFileIndex = args.indexOf('--file');
  const singleFile = singleFileIndex !== -1 ? args[singleFileIndex + 1] : null;

  console.log('=== MOBIUS Documentation Migration ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (singleFile) console.log(`Single file: ${singleFile}`);
  if (resume) console.log('Resuming from checkpoint');
  console.log();

  // Initialize git
  const git = createGitInstance(DOCS_ROOT);
  if (!await isValidRepo(git)) {
    console.error(`ERROR: ${DOCS_ROOT} is not a valid git repository`);
    process.exit(1);
  }

  // Initialize database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobius_wiki'
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('Database connected\n');

    // Load checkpoint if resuming
    let checkpoint = resume ? await loadCheckpoint() : null;
    const startIndex = checkpoint?.lastProcessedIndex || 0;

    // Build user lookup map
    console.log('Loading users...');
    const userMap = await buildUserMap(pool);
    console.log(`  Found ${userMap.size} users\n`);

    // Create wiki structure (idempotent)
    console.log('Creating wiki structure...');
    let wikiId, sectionMap;
    if (dryRun) {
      // Build fake section map for dry run
      wikiId = 0;
      sectionMap = {};
      for (const sectionName of Object.keys(FLAT_SECTIONS)) {
        sectionMap[sectionName] = 0;
      }
      console.log(`  Wiki ID: ${wikiId} (dry run)`);
    } else {
      const result = await createWikiStructure(pool);
      wikiId = result.wikiId;
      sectionMap = result.sectionMap;
      console.log(`  Wiki ID: ${wikiId}`);
    }
    console.log(`  Sections: ${Object.keys(sectionMap).join(', ')}\n`);

    // Discover page files
    console.log('Discovering documentation files...');
    let pageFiles = singleFile ? [singleFile] : await discoverPageFiles();
    console.log(`  Found ${pageFiles.length} pages\n`);

    // Apply checkpoint offset
    if (startIndex > 0) {
      console.log(`  Resuming from index ${startIndex}\n`);
      pageFiles = pageFiles.slice(startIndex);
    }

    // Migration stats
    const stats = {
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      totalVersions: 0,
      errors: []
    };

    // Process each file
    console.log('Migrating pages...\n');
    for (let i = 0; i < pageFiles.length; i++) {
      const file = pageFiles[i];
      const globalIndex = startIndex + i;
      const moduleName = getModuleName(file);
      const moduleConfig = MODULE_MAP[moduleName] || MODULE_MAP['ROOT'];

      // Determine the section ID using the flat section map
      const sectionName = moduleConfig.section || 'General';
      const sectionId = sectionMap[sectionName];

      const fileName = path.basename(file, '.adoc');
      console.log(`[${globalIndex + 1}/${startIndex + pageFiles.length}] ${moduleName}/${fileName}`);

      try {
        if (dryRun) {
          // In dry-run mode, just analyze the file
          const history = await getFileHistory(git, file);
          console.log(`    Would create page with ${history.length} versions`);
          stats.success++;
          stats.totalVersions += history.length;
        } else {
          const result = await migrateFile(pool, git, file, sectionId, userMap, moduleName, skipImages);
          if (result) {
            console.log(`    Created page ID ${result.pageId} with ${result.versionCount} versions`);
            stats.success++;
            stats.totalVersions += result.versionCount;
          } else {
            console.log(`    Skipped (no history or already exists)`);
            stats.skipped++;
          }
        }
      } catch (err) {
        console.error(`    ERROR: ${err.message}`);
        stats.failed++;
        stats.errors.push({ file, error: err.message });
      }

      stats.processed++;

      // Save checkpoint
      if (!dryRun) {
        await saveCheckpoint({ lastProcessedIndex: globalIndex + 1, wikiId, sectionMap });
      }
    }

    // Finalize
    console.log('\nFinalizing...');
    if (!dryRun && stats.success > 0) {
      // Publish all pages
      await pool.query(`
        UPDATE wiki.pages p
        SET status = 'published', published_at = p.created_at
        FROM wiki.sections s
        WHERE p.section_id = s.id
          AND s.wiki_id = $1
          AND p.status = 'draft'
      `, [wikiId]);
      console.log('  Published all pages');

      // Add public access rule (idempotent)
      await pool.query(`
        INSERT INTO wiki.access_rules (ruleable_type, ruleable_id, rule_type, created_by)
        VALUES ('wiki', $1, 'public', 1)
        ON CONFLICT DO NOTHING
      `, [wikiId]);
      console.log('  Added public access rule');
    }

    // Clear checkpoint on success
    if (!dryRun && stats.failed === 0) {
      await clearCheckpoint();
    }

    // Write report
    const report = {
      completedAt: new Date().toISOString(),
      mode: dryRun ? 'dry-run' : 'live',
      wikiId,
      stats,
      sections: Object.entries(sectionMap).map(([slug, id]) => ({ slug, id }))
    };

    if (!dryRun) {
      await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));
      console.log(`  Report: ${REPORT_FILE}`);
    }

    // Summary
    console.log('\n=== Migration Summary ===');
    console.log(`Processed: ${stats.processed}`);
    console.log(`Success: ${stats.success}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Total versions: ${stats.totalVersions}`);

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      for (const err of stats.errors.slice(0, 10)) {
        console.log(`  ${err.file}: ${err.error}`);
      }
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more`);
      }
    }

  } finally {
    await pool.end();
  }
}

/**
 * Discover all .adoc page files in the modules directory
 */
async function discoverPageFiles() {
  const files = [];

  for (const moduleName of Object.keys(MODULE_MAP)) {
    const pagesDir = path.join(MODULES_PATH, moduleName, 'pages');

    try {
      const entries = await fs.readdir(pagesDir, { withFileTypes: true, recursive: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.adoc') && !entry.name.startsWith('_')) {
          // Get the full path relative to DOCS_ROOT
          const fullPath = path.join(entry.parentPath || entry.path, entry.name);
          const relativePath = path.relative(DOCS_ROOT, fullPath);
          files.push(relativePath);
        }
      }
    } catch (err) {
      // Module might not have a pages directory
      if (err.code !== 'ENOENT') {
        console.warn(`Warning: Could not read ${pagesDir}: ${err.message}`);
      }
    }
  }

  // Sort for consistent ordering
  return files.sort();
}

/**
 * Get the module name from a file path
 */
function getModuleName(filePath) {
  const parts = filePath.split(path.sep);
  const modulesIndex = parts.indexOf('modules');
  if (modulesIndex !== -1 && parts.length > modulesIndex + 1) {
    return parts[modulesIndex + 1];
  }
  return 'ROOT';
}

/**
 * Build a map of email -> user ID from the database
 */
async function buildUserMap(pool) {
  const { rows } = await pool.query('SELECT id, email, name FROM wiki.users');
  const map = new Map();
  for (const row of rows) {
    map.set(row.email.toLowerCase(), { id: row.id, name: row.name });
  }
  return map;
}

/**
 * Create the wiki and flat sections (idempotent)
 * Returns sectionMap keyed by section name (e.g., "IT - Policies")
 */
async function createWikiStructure(pool) {
  // Create or get wiki - use 'docs' slug to match seed data
  // Only match by slug to avoid conflicts with duplicate titles
  const { rows: existingWiki } = await pool.query(`
    SELECT id, title FROM wiki.wikis
    WHERE slug = 'docs' AND deleted_at IS NULL
  `);

  let wikiId;
  if (existingWiki.length > 0) {
    wikiId = existingWiki[0].id;
    // Update the wiki title/description if needed
    await pool.query(`
      UPDATE wiki.wikis
      SET title = 'MOBIUS Documentation',
          description = 'Internal documentation migrated from AsciiDoc repository',
          updated_at = NOW()
      WHERE id = $1
    `, [wikiId]);
    console.log(`  Using existing wiki ID: ${wikiId} (slug: docs)`);
  } else {
    const { rows: wikiRows } = await pool.query(`
      INSERT INTO wiki.wikis (title, slug, description, created_by, updated_by)
      VALUES ('MOBIUS Documentation', 'docs',
              'Internal documentation migrated from AsciiDoc repository', 1, 1)
      RETURNING id
    `);
    wikiId = wikiRows[0].id;
    console.log(`  Created wiki ID: ${wikiId}`);
  }

  // Create flat sections (no parent, depth=0, unique sort_order)
  const sectionMap = {};

  for (const [sectionName, config] of Object.entries(FLAT_SECTIONS)) {
    const { rows } = await pool.query(`
      INSERT INTO wiki.sections (wiki_id, parent_section_id, title, slug, description, sort_order, depth, created_by, updated_by)
      VALUES ($1, NULL, $2, $3, $4, $5, 0, 1, 1)
      ON CONFLICT (wiki_id, slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order,
        depth = 0,
        parent_section_id = NULL,
        updated_at = NOW()
      RETURNING id
    `, [wikiId, sectionName, config.slug, config.description, config.sortOrder]);

    sectionMap[sectionName] = rows[0].id;
    console.log(`  Created section: ${sectionName} (ID: ${rows[0].id}, sort_order: ${config.sortOrder})`);
  }

  return { wikiId, sectionMap };
}

/**
 * Migrate a single file with all its git history
 */
async function migrateFile(pool, git, filePath, sectionId, userMap, moduleName, skipImages) {
  // Get file history
  const history = await getFileHistory(git, filePath);
  if (history.length === 0) {
    return null;
  }

  const fileName = path.basename(filePath, '.adoc');
  let pageSlug = generateSlug(fileName);

  // Check if page already exists
  const { rows: existing } = await pool.query(
    'SELECT id FROM wiki.pages WHERE section_id = $1 AND slug = $2',
    [sectionId, pageSlug]
  );

  if (existing.length > 0) {
    // Page exists - skip or update?
    return null;
  }

  let pageId = null;
  let versionNumber = 0;
  let latestTitle = fileName;

  // Process each commit (oldest first)
  for (const commit of history) {
    const content = await getFileAtCommit(git, commit.hash, filePath);
    if (!content) continue;

    // Convert AsciiDoc to HTML
    const { html, title } = convertToHtml(content, {
      pageName: fileName,
      moduleName: moduleName
    });

    latestTitle = title || fileName;

    // Get user ID for this commit
    const normalized = normalizeAuthor(commit.authorName, commit.authorEmail);
    const user = userMap.get(normalized.email.toLowerCase());
    const userId = user ? user.id : 1; // Fall back to admin

    // Parse commit date
    const commitDate = new Date(commit.date);

    versionNumber++;

    if (pageId === null) {
      // First version - create the page
      const { rows } = await pool.query(`
        INSERT INTO wiki.pages
        (section_id, title, slug, content, status, sort_order, created_at, updated_at, created_by, updated_by)
        VALUES ($1, $2, $3, $4, 'draft', 0, $5, $5, $6, $6)
        RETURNING id
      `, [sectionId, latestTitle, pageSlug, html, commitDate, userId]);
      pageId = rows[0].id;
    } else {
      // Subsequent version - update the page
      await pool.query(`
        UPDATE wiki.pages
        SET content = $2, title = $3, updated_at = $4, updated_by = $5
        WHERE id = $1
      `, [pageId, html, latestTitle, commitDate, userId]);
    }

    // Create version entry
    await pool.query(`
      INSERT INTO wiki.page_versions
      (page_id, content, title, version_number, created_at, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [pageId, html, latestTitle, versionNumber, commitDate, userId]);
  }

  return { pageId, versionCount: versionNumber, slug: pageSlug, title: latestTitle };
}

/**
 * Checkpoint management
 */
async function loadCheckpoint() {
  try {
    const data = await fs.readFile(CHECKPOINT_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveCheckpoint(state) {
  await fs.mkdir(path.dirname(CHECKPOINT_FILE), { recursive: true });
  await fs.writeFile(CHECKPOINT_FILE, JSON.stringify(state, null, 2));
}

async function clearCheckpoint() {
  try {
    await fs.unlink(CHECKPOINT_FILE);
  } catch {
    // Ignore if doesn't exist
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
