#!/usr/bin/env node
/**
 * MediaWiki Files Import Script
 *
 * Imports downloaded MediaWiki files into MOBIUS Wiki and updates
 * page content with correct file URLs.
 *
 * Usage:
 *   node scripts/import-mediawiki-files.js --files ./imports/files --wiki "MOBIUS Wiki Import" --dry-run
 *   node scripts/import-mediawiki-files.js --files ./imports/files --wiki "MOBIUS Wiki Import"
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

// =============================================================================
// Configuration & CLI Parsing
// =============================================================================

const args = process.argv.slice(2);
const config = {
  filesPath: null,
  wikiTitle: 'MediaWiki Import',
  uploadsDir: path.join(__dirname, '..', 'uploads'),
  dryRun: false,
  verbose: false,
  userId: 1,
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];

  switch (arg) {
    case '--files':
    case '-f':
      config.filesPath = nextArg;
      i++;
      break;
    case '--wiki':
    case '-w':
      config.wikiTitle = nextArg;
      i++;
      break;
    case '--uploads':
      config.uploadsDir = nextArg;
      i++;
      break;
    case '--user':
    case '-u':
      config.userId = parseInt(nextArg);
      i++;
      break;
    case '--dry-run':
    case '-n':
      config.dryRun = true;
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
MediaWiki Files Import Script

Imports downloaded MediaWiki files into MOBIUS Wiki and updates page content.

Usage:
  node import-mediawiki-files.js --files <dir> --wiki <name> [options]

Required:
  --files, -f <dir>     Directory containing downloaded images

Options:
  --wiki, -w <name>     Target wiki title (default: "MediaWiki Import")
  --uploads <dir>       Backend uploads directory (default: ../uploads)
  --user, -u <id>       User ID to attribute uploads to (default: 1)
  --dry-run, -n         Preview without making changes
  --verbose, -v         Show detailed output
  --help, -h            Show this help message

Example:
  node import-mediawiki-files.js --files ./imports/files --wiki "MOBIUS Wiki Import"
`);
}

if (!config.filesPath) {
  console.error('Error: --files is required. Use --help for usage.');
  process.exit(1);
}

// =============================================================================
// Database Connection
// =============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// =============================================================================
// MIME Type Detection
// =============================================================================

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
};

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// =============================================================================
// File Operations
// =============================================================================

/**
 * Generate unique storage path for a file
 */
function generateStoragePath(filename) {
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext).substring(0, 50);
  const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Include 'uploads/' prefix so getFileBuffer() can find the file with path.join(cwd, storage_path)
  return `uploads/mediawiki-import/${hash}_${safeName}${ext}`;
}

/**
 * Copy file to uploads directory
 * Note: storagePath includes 'uploads/' prefix for database storage,
 * so we use cwd() instead of uploadsDir to avoid double nesting
 */
function copyFileToUploads(sourcePath, storagePath, uploadsDir) {
  // Use cwd() since storagePath already includes 'uploads/' prefix
  const destPath = path.join(process.cwd(), storagePath);
  const destDir = path.dirname(destPath);

  // Create directory if needed
  fs.mkdirSync(destDir, { recursive: true });

  // Copy file
  fs.copyFileSync(sourcePath, destPath);

  return destPath;
}

// =============================================================================
// Main Import Functions
// =============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('MediaWiki Files Import');
  console.log('='.repeat(70));
  console.log(`Files Directory: ${config.filesPath}`);
  console.log(`Target Wiki: ${config.wikiTitle}`);
  console.log(`Uploads Directory: ${config.uploadsDir}`);
  console.log(`Dry Run: ${config.dryRun}`);
  console.log('');

  // Verify files directory exists
  const absoluteFilesPath = path.resolve(config.filesPath);
  if (!fs.existsSync(absoluteFilesPath)) {
    console.error(`Error: Files directory not found: ${absoluteFilesPath}`);
    process.exit(1);
  }

  // Get list of files
  const files = fs.readdirSync(absoluteFilesPath)
    .filter(f => !f.startsWith('.') && !f.startsWith('_'))
    .filter(f => fs.statSync(path.join(absoluteFilesPath, f)).isFile());

  console.log(`Found ${files.length} files to import`);
  console.log('');

  if (files.length === 0) {
    console.log('No files to import.');
    return;
  }

  const stats = {
    imported: 0,
    skipped: 0,
    failed: 0,
    linksCreated: 0,
    contentUpdated: 0,
  };

  if (config.dryRun) {
    console.log('='.repeat(70));
    console.log('DRY RUN - No changes will be made');
    console.log('='.repeat(70));
    console.log('\nWould import files:');
    files.slice(0, 20).forEach(f => console.log(`  - ${f}`));
    if (files.length > 20) {
      console.log(`  ... and ${files.length - 20} more`);
    }
    console.log('\n' + '='.repeat(70));
    console.log('Remove --dry-run to perform actual import');
    return;
  }

  // Connect to database
  console.log('Connecting to database...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get the wiki ID
    const wikiResult = await client.query(
      'SELECT id FROM wiki.wikis WHERE title = $1 AND deleted_at IS NULL',
      [config.wikiTitle]
    );

    if (wikiResult.rows.length === 0) {
      throw new Error(`Wiki "${config.wikiTitle}" not found`);
    }
    const wikiId = wikiResult.rows[0].id;
    console.log(`Found wiki: ${config.wikiTitle} (id: ${wikiId})`);

    // Create uploads directory
    fs.mkdirSync(config.uploadsDir, { recursive: true });

    // Build mapping of filename -> file ID
    const fileIdMap = new Map();

    console.log('\nImporting files...');
    console.log('-'.repeat(70));

    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const sourcePath = path.join(absoluteFilesPath, filename);
      const progress = `[${i + 1}/${files.length}]`;

      try {
        // Check if file already exists in database
        const existing = await client.query(
          'SELECT id FROM wiki.files WHERE filename = $1 AND deleted_at IS NULL',
          [filename]
        );

        if (existing.rows.length > 0) {
          fileIdMap.set(filename, existing.rows[0].id);
          if (config.verbose) {
            console.log(`${progress} SKIP: ${filename} (already exists)`);
          }
          stats.skipped++;
          continue;
        }

        // Get file stats
        const fileStat = fs.statSync(sourcePath);
        const mimeType = getMimeType(filename);
        const storagePath = generateStoragePath(filename);

        // Copy file to uploads
        copyFileToUploads(sourcePath, storagePath, config.uploadsDir);

        // Insert into database
        const insertResult = await client.query(
          `INSERT INTO wiki.files (filename, storage_path, mime_type, size_bytes, uploaded_by)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [filename, storagePath, mimeType, fileStat.size, config.userId]
        );

        const fileId = insertResult.rows[0].id;
        fileIdMap.set(filename, fileId);

        if (config.verbose) {
          const sizeKB = (fileStat.size / 1024).toFixed(1);
          console.log(`${progress} OK: ${filename} (${sizeKB} KB) -> id: ${fileId}`);
        } else {
          process.stdout.write(`\r${progress} ${filename.substring(0, 50).padEnd(50)}`);
        }

        stats.imported++;
      } catch (err) {
        console.log(`\n${progress} FAIL: ${filename} - ${err.message}`);
        stats.failed++;
      }
    }

    console.log('\n');

    // Now update page content to use correct file URLs
    console.log('Updating page content with file URLs...');
    console.log('-'.repeat(70));

    // Get all pages in this wiki
    const pagesResult = await client.query(
      `SELECT p.id, p.title, p.content
       FROM wiki.pages p
       JOIN wiki.sections s ON p.section_id = s.id
       WHERE s.wiki_id = $1 AND p.deleted_at IS NULL`,
      [wikiId]
    );

    for (const page of pagesResult.rows) {
      let content = page.content;
      let updated = false;

      // Find and replace file references
      for (const [filename, fileId] of fileIdMap) {
        // Match various URL patterns for this file
        const patterns = [
          // by-name pattern from import
          new RegExp(`/api/v1/files/by-name/${encodeURIComponent(filename.replace(/ /g, '_'))}`, 'g'),
          new RegExp(`/api/v1/files/by-name/${encodeURIComponent(filename)}`, 'g'),
          // Plain filename in src attributes
          new RegExp(`src="[^"]*${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[_ ]')}[^"]*"`, 'gi'),
        ];

        const newUrl = `/api/v1/files/${fileId}/download`;

        for (const pattern of patterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, (match) => {
              if (match.startsWith('src=')) {
                return `src="${newUrl}"`;
              }
              return newUrl;
            });
            updated = true;
          }
        }
      }

      if (updated) {
        await client.query(
          'UPDATE wiki.pages SET content = $1, updated_at = NOW() WHERE id = $2',
          [content, page.id]
        );

        if (config.verbose) {
          console.log(`  Updated: ${page.title}`);
        }
        stats.contentUpdated++;
      }
    }

    // Also update page_versions content
    console.log('Updating page version history...');
    const versionsResult = await client.query(
      `SELECT pv.id, pv.content
       FROM wiki.page_versions pv
       JOIN wiki.pages p ON pv.page_id = p.id
       JOIN wiki.sections s ON p.section_id = s.id
       WHERE s.wiki_id = $1`,
      [wikiId]
    );

    let versionsUpdated = 0;
    for (const version of versionsResult.rows) {
      let content = version.content;
      let updated = false;

      for (const [filename, fileId] of fileIdMap) {
        const patterns = [
          new RegExp(`/api/v1/files/by-name/${encodeURIComponent(filename.replace(/ /g, '_'))}`, 'g'),
          new RegExp(`/api/v1/files/by-name/${encodeURIComponent(filename)}`, 'g'),
        ];

        const newUrl = `/api/v1/files/${fileId}/download`;

        for (const pattern of patterns) {
          if (pattern.test(content)) {
            content = content.replace(pattern, newUrl);
            updated = true;
          }
        }
      }

      if (updated) {
        await client.query(
          'UPDATE wiki.page_versions SET content = $1 WHERE id = $2',
          [content, version.id]
        );
        versionsUpdated++;
      }
    }

    console.log(`Updated ${versionsUpdated} page versions`);

    await client.query('COMMIT');
    console.log('\nTransaction committed successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nTransaction rolled back due to error:', err.message);
    throw err;
  } finally {
    client.release();
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(70));
  console.log(`Files imported: ${stats.imported}`);
  console.log(`Files skipped: ${stats.skipped}`);
  console.log(`Files failed: ${stats.failed}`);
  console.log(`Pages updated: ${stats.contentUpdated}`);

  await pool.end();
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
