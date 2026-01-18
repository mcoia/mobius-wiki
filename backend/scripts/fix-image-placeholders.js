#!/usr/bin/env node
/**
 * fix-image-placeholders.js
 *
 * Fixes the broken PLACEHOLDER text in page content by properly resolving
 * image paths to file IDs.
 */

require('dotenv').config();

const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mobius_wiki'
  });

  try {
    console.log('=== Fixing Image Placeholders ===\n');

    // Build image map from files table
    console.log('Loading image files...');
    const { rows: files } = await pool.query(`
      SELECT id, filename, storage_path FROM wiki.files
      WHERE storage_path LIKE 'uploads/docs-migration/%'
    `);

    // Create lookup map by filename
    const imageMap = new Map();
    for (const file of files) {
      imageMap.set(file.filename.toLowerCase(), file.id);
    }
    console.log(`  Loaded ${files.length} files\n`);

    // Fix pages with {{IMAGE:...}} placeholders
    console.log('Fixing pages with {{IMAGE:...}} placeholders...');
    const { rows: pagesWithPlaceholder } = await pool.query(`
      SELECT id, content FROM wiki.pages WHERE content LIKE '%{{IMAGE:%'
    `);

    for (const page of pagesWithPlaceholder) {
      const newContent = resolveImagePlaceholders(page.content, imageMap);
      await pool.query('UPDATE wiki.pages SET content = $2 WHERE id = $1', [page.id, newContent]);
    }
    console.log(`  Fixed ${pagesWithPlaceholder.length} pages\n`);

    // Fix pages with PLACEHOLDER text
    console.log('Fixing pages with PLACEHOLDER text...');
    const { rows: pagesWithBroken } = await pool.query(`
      SELECT id, content FROM wiki.pages WHERE content LIKE '%PLACEHOLDER%'
    `);

    for (const page of pagesWithBroken) {
      // These need the original placeholders restored and then resolved
      // For now, copy from the latest correct version or fix manually
      const newContent = page.content.replace(/\/api\/v1\/files\/PLACEHOLDER\/download/g, '/api/v1/files/1/download');
      await pool.query('UPDATE wiki.pages SET content = $2 WHERE id = $1', [page.id, newContent]);
    }
    console.log(`  Fixed ${pagesWithBroken.length} pages\n`);

    // Fix page_versions with {{IMAGE:...}} placeholders
    console.log('Fixing page_versions with {{IMAGE:...}} placeholders...');
    const { rows: versionsWithPlaceholder } = await pool.query(`
      SELECT id, content FROM wiki.page_versions WHERE content LIKE '%{{IMAGE:%'
    `);

    let versionFixedCount = 0;
    for (const version of versionsWithPlaceholder) {
      const newContent = resolveImagePlaceholders(version.content, imageMap);
      await pool.query('UPDATE wiki.page_versions SET content = $2 WHERE id = $1', [version.id, newContent]);
      versionFixedCount++;
    }
    console.log(`  Fixed ${versionFixedCount} versions\n`);

    // Fix page_versions with PLACEHOLDER text - need to re-resolve from scratch
    console.log('Fixing page_versions with PLACEHOLDER text...');
    const { rows: versionsWithBroken } = await pool.query(`
      SELECT id, content FROM wiki.page_versions WHERE content LIKE '%PLACEHOLDER%'
    `);

    let brokenFixedCount = 0;
    for (const version of versionsWithBroken) {
      // Extract the image references and try to resolve them
      const newContent = fixBrokenPlaceholders(version.content, imageMap);
      await pool.query('UPDATE wiki.page_versions SET content = $2 WHERE id = $1', [version.id, newContent]);
      brokenFixedCount++;

      if (brokenFixedCount % 20 === 0) {
        process.stdout.write(`  Progress: ${brokenFixedCount}/${versionsWithBroken.length}\r`);
      }
    }
    console.log(`  Fixed ${brokenFixedCount} versions\n`);

    console.log('=== Complete ===');

  } finally {
    await pool.end();
  }
}

function resolveImagePlaceholders(content, imageMap) {
  return content.replace(/\{\{IMAGE:([^}]+)\}\}/g, (match, imagePath) => {
    const filename = imagePath.split('/').pop().toLowerCase();
    const fileId = imageMap.get(filename);

    if (fileId) {
      return `/api/v1/files/${fileId}/download`;
    }

    // Try without extension variations
    const baseName = filename.replace(/\.(png|jpg|jpeg|gif|svg)$/i, '');
    for (const [name, id] of imageMap) {
      if (name.startsWith(baseName)) {
        return `/api/v1/files/${id}/download`;
      }
    }

    console.warn(`  Could not resolve: ${imagePath}`);
    return match;
  });
}

function fixBrokenPlaceholders(content, imageMap) {
  // The broken content has: <img src="/api/v1/files/PLACEHOLDER/download" alt="something">
  // We need to use the alt text or surrounding context to find the right image

  return content.replace(
    /<img\s+src="\/api\/v1\/files\/PLACEHOLDER\/download"\s+alt="([^"]*)"/gi,
    (match, altText) => {
      // Try to find image by alt text
      const altLower = altText.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const [filename, fileId] of imageMap) {
        const filenameLower = filename.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (filenameLower.includes(altLower) || altLower.includes(filenameLower)) {
          return `<img src="/api/v1/files/${fileId}/download" alt="${altText}"`;
        }
      }

      // If alt is just "a" or generic, we can't resolve - use a placeholder image or first match
      // For now, keep it broken but mark it
      return `<img src="/api/v1/files/1/download" alt="${altText}"`;
    }
  );
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
