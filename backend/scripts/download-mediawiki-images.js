#!/usr/bin/env node
/**
 * Download MediaWiki Images
 *
 * Downloads all images referenced in a MediaWiki XML export file.
 *
 * Usage:
 *   node scripts/download-mediawiki-images.js --xml ../resources/MOBIUS+Wiki-20260209222944.xml
 *   node scripts/download-mediawiki-images.js --xml ../resources/MOBIUS+Wiki-20260209222944.xml --base-url https://wiki.mobiusconsortium.org
 *   node scripts/download-mediawiki-images.js --xml ../resources/MOBIUS+Wiki-20260209222944.xml --dry-run
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const argMap = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    argMap[key] = value;
    if (value !== true) i++;
  }
}

const xmlPath = argMap.xml;
const baseUrl = argMap['base-url'] || 'https://wiki.mobiusconsortium.org';
const outputDir = argMap.output || path.join(__dirname, '..', 'imports', 'files');
const dryRun = argMap['dry-run'] === true;
const concurrency = parseInt(argMap.concurrency) || 5;

if (!xmlPath) {
  console.error('Usage: node download-mediawiki-images.js --xml <path-to-xml>');
  console.error('');
  console.error('Options:');
  console.error('  --xml <path>        Path to MediaWiki XML export (required)');
  console.error('  --base-url <url>    MediaWiki base URL (default: https://wiki.mobiusconsortium.org)');
  console.error('  --output <dir>      Output directory (default: ./imports/files)');
  console.error('  --dry-run           Show what would be downloaded without downloading');
  console.error('  --concurrency <n>   Number of concurrent downloads (default: 5)');
  process.exit(1);
}

// Extract file references from XML
function extractFileReferences(xmlContent) {
  const fileRefs = new Set();

  // Match [[File:filename]] or [[File:filename|options]]
  const filePattern = /\[\[File:([^\]|]+)/gi;
  let match;
  while ((match = filePattern.exec(xmlContent)) !== null) {
    fileRefs.add(match[1].trim());
  }

  // Also match [[:File:filename]] (file links)
  const fileLinkPattern = /\[\[:File:([^\]|]+)/gi;
  while ((match = fileLinkPattern.exec(xmlContent)) !== null) {
    fileRefs.add(match[1].trim());
  }

  return Array.from(fileRefs).sort();
}

// URL encode filename for MediaWiki
function encodeFilename(filename) {
  // MediaWiki uses underscores for spaces in URLs
  return encodeURIComponent(filename.replace(/ /g, '_'));
}

// Download a single file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, {
      headers: { 'User-Agent': 'MOBIUS-Wiki-Import/1.0' },
      timeout: 30000
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          // Handle relative redirects
          const fullRedirectUrl = redirectUrl.startsWith('http')
            ? redirectUrl
            : new URL(redirectUrl, url).toString();
          return downloadFile(fullRedirectUrl, destPath).then(resolve).catch(reject);
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve({ url, destPath, size: fs.statSync(destPath).size });
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}); // Clean up partial file
        reject(err);
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
  });
}

// Process downloads with concurrency limit
async function processDownloads(files, concurrency) {
  const results = { success: [], failed: [], skipped: [] };
  let completed = 0;

  // Create chunks for parallel processing
  async function downloadNext(index) {
    if (index >= files.length) return;

    const filename = files[index];
    const encodedFilename = encodeFilename(filename);
    const url = `${baseUrl}/wiki/Special:FilePath/${encodedFilename}`;
    const destPath = path.join(outputDir, filename.replace(/ /g, '_'));

    // Skip if already exists
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > 0) {
        completed++;
        results.skipped.push({ filename, reason: 'already exists' });
        console.log(`[${completed}/${files.length}] SKIP: ${filename} (already exists)`);
        return downloadNext(index + concurrency);
      }
    }

    if (dryRun) {
      completed++;
      console.log(`[${completed}/${files.length}] WOULD DOWNLOAD: ${filename}`);
      console.log(`  URL: ${url}`);
      return downloadNext(index + concurrency);
    }

    try {
      const result = await downloadFile(url, destPath);
      completed++;
      results.success.push(result);
      const sizeKB = (result.size / 1024).toFixed(1);
      console.log(`[${completed}/${files.length}] OK: ${filename} (${sizeKB} KB)`);
    } catch (err) {
      completed++;
      results.failed.push({ filename, url, error: err.message });
      console.log(`[${completed}/${files.length}] FAIL: ${filename} - ${err.message}`);
    }

    return downloadNext(index + concurrency);
  }

  // Start concurrent downloads
  const promises = [];
  for (let i = 0; i < Math.min(concurrency, files.length); i++) {
    promises.push(downloadNext(i));
  }
  await Promise.all(promises);

  return results;
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('MediaWiki Image Downloader');
  console.log('='.repeat(60));
  console.log(`XML File: ${xmlPath}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log('');

  // Read XML file
  const absoluteXmlPath = path.resolve(xmlPath);
  if (!fs.existsSync(absoluteXmlPath)) {
    console.error(`Error: XML file not found: ${absoluteXmlPath}`);
    process.exit(1);
  }

  console.log('Reading XML file...');
  const xmlContent = fs.readFileSync(absoluteXmlPath, 'utf8');

  // Extract file references
  console.log('Extracting file references...');
  const files = extractFileReferences(xmlContent);
  console.log(`Found ${files.length} unique files`);
  console.log('');

  if (files.length === 0) {
    console.log('No files to download.');
    return;
  }

  // Create output directory
  if (!dryRun) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Download files
  console.log('Starting downloads...');
  console.log('-'.repeat(60));

  const results = await processDownloads(files, concurrency);

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files: ${files.length}`);
  console.log(`Downloaded: ${results.success.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  console.log(`Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('');
    console.log('Failed downloads:');
    results.failed.forEach(f => {
      console.log(`  - ${f.filename}: ${f.error}`);
    });

    // Write failed list to file for retry
    const failedPath = path.join(outputDir, '_failed.txt');
    fs.writeFileSync(failedPath, results.failed.map(f => f.filename).join('\n'));
    console.log(`\nFailed filenames saved to: ${failedPath}`);
  }

  if (dryRun) {
    console.log('');
    console.log('This was a dry run. No files were downloaded.');
    console.log('Remove --dry-run to actually download files.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
