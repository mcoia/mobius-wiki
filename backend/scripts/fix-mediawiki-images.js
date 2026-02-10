#!/usr/bin/env node
/**
 * Fix MediaWiki Image References
 *
 * Updates page content to convert [[File:...]] references to proper <img> tags
 * and updates file URLs to use file IDs.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Parse command line arguments
const args = process.argv.slice(2);
const wikiTitle = args.find((a, i) => args[i-1] === '--wiki') || 'MOBIUS Wiki Import';
const dryRun = args.includes('--dry-run');

async function main() {
  console.log('='.repeat(70));
  console.log('Fix MediaWiki Image References');
  console.log('='.repeat(70));
  console.log(`Wiki: ${wikiTitle}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log('');

  const client = await pool.connect();

  try {
    // Get wiki ID
    const wikiResult = await client.query(
      'SELECT id FROM wiki.wikis WHERE title = $1 AND deleted_at IS NULL',
      [wikiTitle]
    );

    if (wikiResult.rows.length === 0) {
      throw new Error(`Wiki "${wikiTitle}" not found`);
    }
    const wikiId = wikiResult.rows[0].id;

    // Build filename -> file ID map
    const filesResult = await client.query(
      'SELECT id, filename FROM wiki.files WHERE deleted_at IS NULL'
    );
    const fileMap = new Map();
    for (const file of filesResult.rows) {
      fileMap.set(file.filename, file.id);
      // Also map with underscores replaced by spaces and vice versa
      fileMap.set(file.filename.replace(/_/g, ' '), file.id);
      fileMap.set(file.filename.replace(/ /g, '_'), file.id);
    }
    console.log(`Loaded ${filesResult.rows.length} files into map`);

    // Get all pages from this wiki
    const pagesResult = await client.query(
      `SELECT p.id, p.title, p.content
       FROM wiki.pages p
       JOIN wiki.sections s ON p.section_id = s.id
       WHERE s.wiki_id = $1 AND p.deleted_at IS NULL`,
      [wikiId]
    );
    console.log(`Found ${pagesResult.rows.length} pages to check`);

    if (!dryRun) {
      await client.query('BEGIN');
    }

    let pagesUpdated = 0;
    let imagesFixed = 0;

    for (const page of pagesResult.rows) {
      let content = page.content;
      let updated = false;
      let pageImageCount = 0;

      // Convert [[File:...]] to <img> with file ID URLs (using /download endpoint for binary data)
      content = content.replace(/\[\[File:([^\]|]+)(\|[^\]]+)?\]\]/gi, (match, filename, options) => {
        const cleanFilename = filename.trim().replace(/ /g, '_');
        const fileId = fileMap.get(cleanFilename) || fileMap.get(filename.trim());

        pageImageCount++;
        updated = true;

        if (fileId) {
          return `<img src="/api/v1/files/${fileId}/download" alt="${filename}" class="wiki-image">`;
        } else {
          // Keep placeholder URL if file not found
          return `<img src="/api/v1/files/by-name/${encodeURIComponent(cleanFilename)}" alt="${filename}" class="wiki-image wiki-image-missing">`;
        }
      });

      // Convert [[:File:...]] to <a> with file ID URLs (using /download endpoint for binary data)
      content = content.replace(/\[\[:File:([^\]|]+)(\|([^\]]+))?\]\]/gi, (match, filename, _, label) => {
        const cleanFilename = filename.trim().replace(/ /g, '_');
        const displayLabel = label || filename;
        const fileId = fileMap.get(cleanFilename) || fileMap.get(filename.trim());

        pageImageCount++;
        updated = true;

        if (fileId) {
          return `<a href="/api/v1/files/${fileId}/download" class="wiki-file-link">${displayLabel}</a>`;
        } else {
          return `<a href="/api/v1/files/by-name/${encodeURIComponent(cleanFilename)}" class="wiki-file-link wiki-file-missing">${displayLabel}</a>`;
        }
      });

      // Also update any existing by-name URLs to use file IDs with /download
      content = content.replace(/\/api\/v1\/files\/by-name\/([^"'\s>]+)/g, (match, encodedFilename) => {
        const filename = decodeURIComponent(encodedFilename);
        const fileId = fileMap.get(filename) || fileMap.get(filename.replace(/_/g, ' '));

        if (fileId) {
          updated = true;
          pageImageCount++;
          return `/api/v1/files/${fileId}/download`;
        }
        return match;
      });

      // Update existing /api/v1/files/{id} URLs (without /download) to include /download
      content = content.replace(/\/api\/v1\/files\/(\d+)(?!\/download)(?=["'\s>])/g, (match, fileId) => {
        updated = true;
        pageImageCount++;
        return `/api/v1/files/${fileId}/download`;
      });

      if (updated) {
        imagesFixed += pageImageCount;
        pagesUpdated++;

        if (!dryRun) {
          await client.query(
            'UPDATE wiki.pages SET content = $1, updated_at = NOW() WHERE id = $2',
            [content, page.id]
          );
        }
        console.log(`  Updated: ${page.title} (${pageImageCount} images)`);
      }
    }

    // Also update page_versions
    console.log('\nUpdating page versions...');
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

      // Same transformations for versions (with /download endpoint)
      content = content.replace(/\[\[File:([^\]|]+)(\|[^\]]+)?\]\]/gi, (match, filename) => {
        const cleanFilename = filename.trim().replace(/ /g, '_');
        const fileId = fileMap.get(cleanFilename) || fileMap.get(filename.trim());
        updated = true;
        if (fileId) {
          return `<img src="/api/v1/files/${fileId}/download" alt="${filename}" class="wiki-image">`;
        } else {
          return `<img src="/api/v1/files/by-name/${encodeURIComponent(cleanFilename)}" alt="${filename}" class="wiki-image wiki-image-missing">`;
        }
      });

      content = content.replace(/\[\[:File:([^\]|]+)(\|([^\]]+))?\]\]/gi, (match, filename, _, label) => {
        const cleanFilename = filename.trim().replace(/ /g, '_');
        const displayLabel = label || filename;
        const fileId = fileMap.get(cleanFilename) || fileMap.get(filename.trim());
        updated = true;
        if (fileId) {
          return `<a href="/api/v1/files/${fileId}/download" class="wiki-file-link">${displayLabel}</a>`;
        } else {
          return `<a href="/api/v1/files/by-name/${encodeURIComponent(cleanFilename)}" class="wiki-file-link wiki-file-missing">${displayLabel}</a>`;
        }
      });

      content = content.replace(/\/api\/v1\/files\/by-name\/([^"'\s>]+)/g, (match, encodedFilename) => {
        const filename = decodeURIComponent(encodedFilename);
        const fileId = fileMap.get(filename) || fileMap.get(filename.replace(/_/g, ' '));
        if (fileId) {
          updated = true;
          return `/api/v1/files/${fileId}/download`;
        }
        return match;
      });

      // Update existing /api/v1/files/{id} URLs (without /download) to include /download
      content = content.replace(/\/api\/v1\/files\/(\d+)(?!\/download)(?=["'\s>])/g, (match, fileId) => {
        updated = true;
        return `/api/v1/files/${fileId}/download`;
      });

      if (updated) {
        versionsUpdated++;
        if (!dryRun) {
          await client.query(
            'UPDATE wiki.page_versions SET content = $1 WHERE id = $2',
            [content, version.id]
          );
        }
      }
    }

    if (!dryRun) {
      await client.query('COMMIT');
    }

    console.log('\n' + '='.repeat(70));
    console.log('COMPLETE');
    console.log('='.repeat(70));
    console.log(`Pages updated: ${pagesUpdated}`);
    console.log(`Images fixed: ${imagesFixed}`);
    console.log(`Versions updated: ${versionsUpdated}`);

    if (dryRun) {
      console.log('\nThis was a dry run. No changes were made.');
    }

  } catch (err) {
    if (!dryRun) {
      await client.query('ROLLBACK');
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
