#!/usr/bin/env node
/**
 * import-docs-images.js
 *
 * Imports images from resources/docs/ into the wiki file system
 * and updates page content to reference the new file paths.
 *
 * Usage:
 *   node scripts/import-docs-images.js
 *   node scripts/import-docs-images.js --dry-run
 *   node scripts/import-docs-images.js --resolve-only  # Only resolve paths, don't copy files
 */

require('dotenv').config();

const { Pool } = require('pg');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Paths
const DOCS_ROOT = path.join(__dirname, '../../resources/docs');
const MODULES_PATH = path.join(DOCS_ROOT, 'base_docs/docs/modules');
const UPLOADS_DIR = path.join(__dirname, '../uploads/docs-migration');
const REPORT_FILE = path.join(__dirname, '../migration-data/images-report.json');

// MIME type mapping
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const resolveOnly = args.includes('--resolve-only');

  console.log('=== MOBIUS Documentation Image Import ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : resolveOnly ? 'RESOLVE ONLY' : 'LIVE'}`);
  console.log();

  // Initialize database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobius_wiki'
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('Database connected\n');

    // Ensure uploads directory exists
    if (!dryRun && !resolveOnly) {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      console.log(`Uploads directory: ${UPLOADS_DIR}\n`);
    }

    // Discover all images
    console.log('Discovering images...');
    const images = await discoverImages();
    console.log(`  Found ${images.length} images\n`);

    // Import images
    const imageMap = {}; // path -> fileId
    const stats = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    if (!resolveOnly) {
      console.log('Importing images...\n');

      for (const image of images) {
        const relativePath = path.relative(MODULES_PATH, image.fullPath);
        process.stdout.write(`  ${relativePath}... `);

        try {
          if (dryRun) {
            console.log('would import');
            stats.imported++;
          } else {
            const fileId = await importImage(pool, image);
            imageMap[relativePath] = fileId;

            // Also map by various path formats for resolution
            const pathVariants = generatePathVariants(image);
            for (const variant of pathVariants) {
              imageMap[variant] = fileId;
            }

            console.log(`ID ${fileId}`);
            stats.imported++;
          }
        } catch (err) {
          console.log(`ERROR: ${err.message}`);
          stats.failed++;
          stats.errors.push({ path: relativePath, error: err.message });
        }
      }
    } else {
      // Load existing images from database
      console.log('Loading existing images from database...');
      const { rows } = await pool.query(`
        SELECT id, filename, storage_path FROM wiki.files
        WHERE storage_path LIKE 'uploads/docs-migration/%'
      `);

      for (const row of rows) {
        // Extract the original path from storage_path
        const filename = row.filename;
        imageMap[filename] = row.id;
      }
      console.log(`  Found ${rows.length} existing images\n`);
    }

    // Resolve image placeholders in pages
    console.log('\nResolving image placeholders in pages...');
    const resolveStats = await resolveImagePlaceholders(pool, imageMap, dryRun);
    console.log(`  Updated ${resolveStats.pagesUpdated} pages`);
    console.log(`  Resolved ${resolveStats.placeholdersResolved} placeholders`);
    console.log(`  Unresolved: ${resolveStats.placeholdersUnresolved}`);

    // Write report
    const report = {
      completedAt: new Date().toISOString(),
      mode: dryRun ? 'dry-run' : resolveOnly ? 'resolve-only' : 'live',
      imagesImported: stats.imported,
      imagesSkipped: stats.skipped,
      imagesFailed: stats.failed,
      pagesUpdated: resolveStats.pagesUpdated,
      placeholdersResolved: resolveStats.placeholdersResolved,
      placeholdersUnresolved: resolveStats.placeholdersUnresolved,
      errors: stats.errors
    };

    if (!dryRun) {
      await fs.mkdir(path.dirname(REPORT_FILE), { recursive: true });
      await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));
      console.log(`\nReport: ${REPORT_FILE}`);
    }

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Images imported: ${stats.imported}`);
    console.log(`Images failed: ${stats.failed}`);
    console.log(`Pages updated: ${resolveStats.pagesUpdated}`);

  } finally {
    await pool.end();
  }
}

/**
 * Discover all image files in the modules directory
 */
async function discoverImages() {
  const images = [];
  const validExtensions = Object.keys(MIME_TYPES);

  async function scanDir(dir, moduleName) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await scanDir(fullPath, moduleName);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (validExtensions.includes(ext)) {
            const stats = await fs.stat(fullPath);
            images.push({
              fullPath,
              moduleName,
              filename: entry.name,
              ext,
              size: stats.size,
              mimeType: MIME_TYPES[ext]
            });
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`Warning: Could not read ${dir}: ${err.message}`);
      }
    }
  }

  // Scan each module's assets/images directory
  const modules = await fs.readdir(MODULES_PATH);
  for (const moduleName of modules) {
    const imagesDir = path.join(MODULES_PATH, moduleName, 'assets', 'images');
    await scanDir(imagesDir, moduleName);
  }

  return images;
}

/**
 * Import a single image file
 */
async function importImage(pool, image) {
  // Generate unique storage filename
  const hash = crypto.randomBytes(8).toString('hex');
  const storageName = `${path.basename(image.filename, image.ext)}_${hash}${image.ext}`;
  const storagePath = `uploads/docs-migration/${storageName}`;
  const destPath = path.join(__dirname, '..', storagePath);

  // Copy file
  await fs.copyFile(image.fullPath, destPath);

  // Insert into database
  const { rows } = await pool.query(`
    INSERT INTO wiki.files
    (filename, storage_path, mime_type, size_bytes, uploaded_by, uploaded_at)
    VALUES ($1, $2, $3, $4, 1, NOW())
    RETURNING id
  `, [image.filename, storagePath, image.mimeType, image.size]);

  return rows[0].id;
}

/**
 * Generate various path formats for matching
 */
function generatePathVariants(image) {
  const variants = [];
  const relativePath = path.relative(MODULES_PATH, image.fullPath);

  // Various formats that might appear in content
  variants.push(relativePath);
  variants.push(image.filename);
  variants.push(relativePath.replace(/\\/g, '/'));

  // Module-relative paths
  const parts = relativePath.split(path.sep);
  if (parts.length >= 3 && parts[1] === 'assets' && parts[2] === 'images') {
    // moduleName/assets/images/subdir/file.png -> subdir/file.png
    variants.push(parts.slice(3).join('/'));
  }

  return variants;
}

/**
 * Resolve {{IMAGE:path}} placeholders in page content
 */
async function resolveImagePlaceholders(pool, imageMap, dryRun) {
  const stats = {
    pagesUpdated: 0,
    placeholdersResolved: 0,
    placeholdersUnresolved: 0
  };

  // Find pages with image placeholders
  const { rows: pages } = await pool.query(`
    SELECT id, content FROM wiki.pages
    WHERE content LIKE '%{{IMAGE:%'
  `);

  for (const page of pages) {
    let content = page.content;
    let modified = false;

    content = content.replace(/\{\{IMAGE:([^}]+)\}\}/g, (match, imagePath) => {
      // Try to find the image in our map
      const fileId = findImageId(imagePath, imageMap);

      if (fileId) {
        stats.placeholdersResolved++;
        modified = true;
        return `/api/v1/files/${fileId}/download`;
      } else {
        stats.placeholdersUnresolved++;
        console.warn(`    Unresolved: ${imagePath}`);
        return match; // Keep placeholder
      }
    });

    if (modified && !dryRun) {
      await pool.query('UPDATE wiki.pages SET content = $2 WHERE id = $1', [page.id, content]);
      stats.pagesUpdated++;
    } else if (modified) {
      stats.pagesUpdated++;
    }
  }

  // Also update page_versions with placeholders
  console.log('\nResolving image placeholders in page_versions...');
  const { rows: versions } = await pool.query(`
    SELECT id, content FROM wiki.page_versions
    WHERE content LIKE '%{{IMAGE:%'
  `);

  let versionsUpdated = 0;
  for (const version of versions) {
    let content = version.content;
    let modified = false;

    content = content.replace(/\{\{IMAGE:([^}]+)\}\}/g, (match, imagePath) => {
      const fileId = findImageId(imagePath, imageMap);
      if (fileId) {
        modified = true;
        return `/api/v1/files/${fileId}/download`;
      }
      return match;
    });

    if (modified && !dryRun) {
      await pool.query('UPDATE wiki.page_versions SET content = $2 WHERE id = $1', [version.id, content]);
      versionsUpdated++;
    }
  }
  console.log(`  Updated ${versionsUpdated} page_versions`);

  return stats;
}

/**
 * Try various path formats to find an image ID
 */
function findImageId(imagePath, imageMap) {
  // Normalize path
  const normalized = imagePath.replace(/\\/g, '/');

  // Try exact match
  if (imageMap[normalized]) return imageMap[normalized];

  // Try just the filename
  const filename = normalized.split('/').pop();
  if (imageMap[filename]) return imageMap[filename];

  // Try without leading module/pagename
  const parts = normalized.split('/');
  for (let i = 0; i < parts.length; i++) {
    const subPath = parts.slice(i).join('/');
    if (imageMap[subPath]) return imageMap[subPath];
  }

  return null;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
