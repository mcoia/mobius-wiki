#!/usr/bin/env node
/**
 * MediaWiki to MOBIUS Wiki Import Script
 *
 * Imports pages from a MediaWiki XML export into MOBIUS Wiki,
 * converting wikitext to HTML and preserving revision history.
 *
 * Multi-Wiki Mode (default):
 *   Creates 4 separate wikis (FOLIO, EDS, OpenRS, Panorama) based on
 *   booknav tags and title patterns.
 *
 * Single-Wiki Mode (legacy):
 *   Use --single-wiki <name> to import all pages into one wiki.
 *
 * Usage:
 *   node scripts/import-mediawiki.js --file ../resources/MOBIUS+Wiki-20260209222944.xml --dry-run
 *   node scripts/import-mediawiki.js --file ../resources/MOBIUS+Wiki-20260209222944.xml
 *   node scripts/import-mediawiki.js --file ../resources/MOBIUS+Wiki-20260209222944.xml --single-wiki "Legacy Import"
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const xml2js = require('xml2js');
const wtf = require('wtf_wikipedia');
require('dotenv').config();

// =============================================================================
// Multi-Wiki Configuration
// =============================================================================

/**
 * Wiki configurations for multi-wiki mode.
 * Priority: booknav patterns checked first, then title patterns, then default.
 */
const WIKI_CONFIGS = {
  eds: {
    key: 'eds',
    title: 'EDS',
    slug: 'eds',
    description: 'EBSCO Discovery Service documentation for the MOBIUS Consortium',
    booknavPatterns: ['EDS wiki'],
    titlePatterns: [
      /^EDS\b/i,
      /^EBSCO/i,
      /Evolution of EBSCOhost/i,
    ],
    isDefault: false,
  },
  panorama: {
    key: 'panorama',
    title: 'Panorama',
    slug: 'panorama',
    description: 'Panorama analytics and reporting documentation',
    booknavPatterns: ['Panorama'],
    titlePatterns: [
      /^Panorama/i,
    ],
    isDefault: false,
  },
  openrs: {
    key: 'openrs',
    title: 'OpenRS',
    slug: 'openrs',
    description: 'OpenRS resource sharing documentation for the MOBIUS Consortium',
    booknavPatterns: ['OpenRS wiki'],
    titlePatterns: [
      /^OpenRS/i,
      /OpenRS\b/i, // Any title containing "OpenRS"
      /^7\.\d+\s+DCB/i,
      /^7\.\d+\s+(?!FOLIO)/i, // 7.x patterns not followed by FOLIO
      /^7\s+DCB/i,
      /^DCB\b/i,
      /Active OpenRS/i,
      /^Controlling\s+Lending/i,
      /Format\s+Filtering\s+in\s+OpenRS/i,
      /Returned\s+OpenRS\s+Books/i,
      /Stop.*Borrowing.*Lending/i, // Borrowing/lending controls
      /Temporarily\s+Stopping\s+Borrowing/i,
    ],
    isDefault: false,
  },
  folio: {
    key: 'folio',
    title: 'FOLIO',
    slug: 'folio',
    description: 'FOLIO ILS documentation for the MOBIUS Consortium',
    booknavPatterns: ['FOLIO WIKI'],
    titlePatterns: [
      /^FOLIO/i,
      /^Folio\b/i,
      /^Inventory/i,
      /^Course\s*Reserves?/i,
      /^Bulk\s*Edit/i,
      /^Lists\b/i,
      /^Finance\b/i,
      /^Acquisitions/i,
      /^Serials/i,
      /^20\d{6}.*FOLIO/i, // Dated FOLIO pages
      /^20\d{6}.*Serials/i,
      /^20\d{6}.*Acquisitions/i,
      /^7\s+FOLIO/i,
      /Connexion/i,
      /^OCLC/i,
      /^CQL\s+Query/i,
      /^Batchloading/i,
      /^Batch\s+Updating/i,
      /permissions/i,
    ],
    isDefault: true, // Default wiki for unmatched pages
  },
};

// Order matters: more specific wikis checked first
const WIKI_CHECK_ORDER = ['eds', 'panorama', 'openrs', 'folio'];

/**
 * Extract booknav book assignment from wikitext.
 * Handles both raw and HTML-encoded versions.
 *
 * Examples:
 *   <booknav book="FOLIO WIKI" />
 *   &lt;booknav book="EDS wiki" /&gt;
 *
 * @param {string} wikitext - Raw wikitext content
 * @returns {string|null} - Book name or null if not found
 */
function extractBooknavAssignment(wikitext) {
  if (!wikitext) return null;

  // Match both raw and HTML-encoded versions
  // Raw: <booknav book="FOLIO WIKI" />
  // Encoded: &lt;booknav book="EDS wiki" /&gt;
  const patterns = [
    /<booknav\s+book="([^"]+)"\s*\/?>/i,
    /&lt;booknav\s+book="([^"]+)"\s*\/?&gt;/i,
    /booknav\s+book="([^"]+)"/i, // Fallback partial match
  ];

  for (const pattern of patterns) {
    const match = wikitext.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Determine which wiki a page should be assigned to.
 *
 * @param {string} title - Page title
 * @param {string} wikitext - Page wikitext content
 * @returns {{ wikiKey: string, method: 'booknav'|'title'|'default' }}
 */
function determineWikiAssignment(title, wikitext) {
  // 1. Check booknav tag first (highest priority)
  const booknavBook = extractBooknavAssignment(wikitext);
  if (booknavBook) {
    for (const wikiKey of WIKI_CHECK_ORDER) {
      const wikiConfig = WIKI_CONFIGS[wikiKey];
      for (const pattern of wikiConfig.booknavPatterns) {
        if (booknavBook.toLowerCase() === pattern.toLowerCase()) {
          return { wikiKey, method: 'booknav' };
        }
      }
    }
  }

  // 2. Check title patterns (in priority order)
  for (const wikiKey of WIKI_CHECK_ORDER) {
    const wikiConfig = WIKI_CONFIGS[wikiKey];
    for (const pattern of wikiConfig.titlePatterns) {
      if (pattern.test(title)) {
        return { wikiKey, method: 'title' };
      }
    }
  }

  // 3. Default to FOLIO
  const defaultWiki = Object.values(WIKI_CONFIGS).find(w => w.isDefault);
  return { wikiKey: defaultWiki.key, method: 'default' };
}

/**
 * Infer section from page title for a specific wiki.
 * Each wiki has its own section groupings.
 *
 * @param {string} title - Page title
 * @param {string} wikiKey - Wiki key (folio, openrs, eds, panorama)
 * @returns {string} - Section name
 */
function inferSectionForWiki(title, wikiKey) {
  // Wiki-specific section patterns
  const sectionPatterns = {
    folio: [
      { pattern: /^20\d{6}.*Serials/i, section: 'Serials Training' },
      { pattern: /^20\d{6}.*Acquisitions/i, section: 'Acquisitions Training' },
      { pattern: /^20\d{6}/i, section: 'Training Sessions' },
      { pattern: /^FOLIO\s*Serials|^Serials/i, section: 'Serials' },
      { pattern: /^FOLIO\s*Acquisitions|^Acquisitions/i, section: 'Acquisitions' },
      { pattern: /^Finance/i, section: 'Finance' },
      { pattern: /^Inventory|^CQL|^Bulk\s*Edit|^Lists/i, section: 'Inventory' },
      { pattern: /^Course\s*Reserves/i, section: 'Course Reserves' },
      { pattern: /permissions/i, section: 'Permissions' },
      { pattern: /Connexion|^OCLC/i, section: 'OCLC/Connexion' },
      { pattern: /^Batchloading|^Batch\s+Updating/i, section: 'Batch Operations' },
      { pattern: /^FOLIO\s+Calendar/i, section: 'Settings' },
      { pattern: /^FOLIO\s+Query/i, section: 'Search & Query' },
    ],
    openrs: [
      { pattern: /^7\.\d+\s+DCB|^7\s+DCB|^DCB\s+Admin/i, section: 'DCB Admin' },
      { pattern: /^DCB\s+Request/i, section: 'DCB Requesting' },
      { pattern: /^7\.\d+/i, section: 'Version Documentation' },
      { pattern: /^Active\s+OpenRS/i, section: 'Active Loans' },
      { pattern: /^Controlling\s+Lending|Temporarily\s+Stopping\s+Borrowing|Stop.*Borrowing/i, section: 'Lending Controls' },
      { pattern: /Format\s+Filtering/i, section: 'Filtering' },
      { pattern: /OpenRS\s+Statistics/i, section: 'Statistics' },
      { pattern: /Returned\s+OpenRS\s+Books/i, section: 'Returns' },
    ],
    eds: [
      { pattern: /^EDS\s+Table/i, section: 'Getting Started' },
      { pattern: /Evolution|EBSCOhost/i, section: 'Guides' },
    ],
    panorama: [
      { pattern: /^Panorama/i, section: 'Reports' },
    ],
  };

  const patterns = sectionPatterns[wikiKey] || [];
  for (const { pattern, section } of patterns) {
    if (pattern.test(title)) {
      return section;
    }
  }

  return 'General';
}

// =============================================================================
// Configuration & CLI Parsing
// =============================================================================

const args = process.argv.slice(2);
const config = {
  xmlPath: null,
  filesPath: null,
  singleWikiTitle: null, // If set, use legacy single-wiki mode
  dryRun: false,
  verbose: false,
  userId: 1, // Default user ID for attributing content
  skipNamespaces: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], // Skip talk, user, file, template, etc
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const nextArg = args[i + 1];

  switch (arg) {
    case '--file':
    case '-f':
      config.xmlPath = nextArg;
      i++;
      break;
    case '--files':
      config.filesPath = nextArg;
      i++;
      break;
    case '--single-wiki':
    case '--wiki':
    case '-w':
      config.singleWikiTitle = nextArg;
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
MediaWiki to MOBIUS Wiki Import Script

Imports pages from MediaWiki XML into MOBIUS Wiki. By default, creates 4 wikis
(FOLIO, EDS, OpenRS, Panorama) based on booknav tags and title patterns.

Usage:
  node import-mediawiki.js --file <xml-path> [options]

Required:
  --file, -f <path>       Path to MediaWiki XML export file

Options:
  --single-wiki <name>    Legacy mode: import all pages to a single wiki
  --wiki, -w <name>       Alias for --single-wiki
  --files <dir>           Directory containing downloaded images
  --user, -u <id>         User ID to attribute content to (default: 1)
  --dry-run, -n           Preview what would be imported without making DB changes
  --verbose, -v           Show detailed output
  --help, -h              Show this help message

Multi-Wiki Mode (default):
  Pages are assigned to wikis based on:
    1. Booknav tags (e.g., <booknav book="FOLIO WIKI" />) - highest priority
    2. Title patterns (e.g., pages starting with "OpenRS") - fallback
    3. Default wiki (FOLIO) - for unmatched pages

  Assignment indicators in dry-run output:
    [B] = Matched by booknav tag
    [T] = Matched by title pattern
    [D] = Default assignment (no match)

Examples:
  # Dry run to preview multi-wiki import
  node import-mediawiki.js --file export.xml --dry-run

  # Full multi-wiki import
  node import-mediawiki.js --file export.xml

  # Legacy single-wiki import
  node import-mediawiki.js --file export.xml --single-wiki "BlueSpice Import"
`);
}

if (!config.xmlPath) {
  console.error('Error: --file is required. Use --help for usage.');
  process.exit(1);
}

// =============================================================================
// Database Connection
// =============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// =============================================================================
// Wikitext to HTML Conversion
// =============================================================================

/**
 * Convert MediaWiki wikitext to clean HTML
 *
 * Uses the simple converter as the primary method since wtf_wikipedia
 * strips file references and complex markup.
 */
function wikitextToHtml(wikitext, pageTitle) {
  if (!wikitext || wikitext.trim() === '') {
    return '';
  }

  // Use the simple converter which properly handles all our markup including images
  // wtf_wikipedia strips [[File:...]] references, so we don't use it
  const html = simpleWikitextToHtml(wikitext);

  // Post-process to clean up
  return postProcessHtml(html, wikitext);
}

/**
 * Simple fallback wikitext to HTML converter
 */
function simpleWikitextToHtml(wikitext) {
  let html = wikitext;

  // Preserve existing HTML tags first (decode HTML entities)
  html = html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  // Handle file/image references BEFORE other processing
  // [[File:filename|options]] -> <img>
  html = html.replace(/\[\[File:([^\]|]+)(\|[^\]]+)?\]\]/gi, (match, filename, options) => {
    const cleanFilename = filename.trim().replace(/ /g, '_');
    return `<img src="/api/v1/files/by-name/${encodeURIComponent(cleanFilename)}" alt="${filename}" class="wiki-image">`;
  });

  // Handle file links [[:File:...]] -> <a>
  html = html.replace(/\[\[:File:([^\]|]+)(\|([^\]]+))?\]\]/gi, (match, filename, _, label) => {
    const cleanFilename = filename.trim().replace(/ /g, '_');
    const displayLabel = label || filename;
    return `<a href="/api/v1/files/by-name/${encodeURIComponent(cleanFilename)}" class="wiki-file-link">${displayLabel}</a>`;
  });

  // Headers (must process longest first)
  html = html.replace(/^======(.+?)======$/gm, '<h6>$1</h6>');
  html = html.replace(/^=====(.+?)=====$/gm, '<h5>$1</h5>');
  html = html.replace(/^====(.+?)====$/gm, '<h4>$1</h4>');
  html = html.replace(/^===(.+?)===$/gm, '<h3>$1</h3>');
  html = html.replace(/^==(.+?)==$/gm, '<h2>$1</h2>');
  html = html.replace(/^=(.+?)=$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/'''''(.+?)'''''/g, '<strong><em>$1</em></strong>');
  html = html.replace(/'''(.+?)'''/g, '<strong>$1</strong>');
  html = html.replace(/''(.+?)''/g, '<em>$1</em>');

  // Lists (ordered)
  html = html.replace(/^#\s+(.+)$/gm, '<li>$1</li>');

  // Lists (unordered)
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');

  // External links: [url text]
  html = html.replace(/\[([^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1" target="_blank" rel="noopener">$2</a>');

  // External links (bare): [url]
  html = html.replace(/\[([^\s\]]+)\]/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  // Line breaks
  html = html.replace(/<br\s*\/?>/gi, '<br>');

  // Wrap consecutive <li> in <ul> or <ol>
  html = wrapLists(html);

  // Paragraphs (blank lines)
  html = html.split(/\n\n+/).map(p => {
    p = p.trim();
    if (p && !p.startsWith('<h') && !p.startsWith('<ul') && !p.startsWith('<ol') && !p.startsWith('<table') && !p.startsWith('<div')) {
      return `<p>${p}</p>`;
    }
    return p;
  }).join('\n\n');

  return html;
}

/**
 * Wrap consecutive <li> elements in proper list containers
 */
function wrapLists(html) {
  const lines = html.split('\n');
  const result = [];
  let inList = false;
  let listType = null;

  for (const line of lines) {
    if (line.trim().startsWith('<li>')) {
      if (!inList) {
        // Determine list type from original markup (check previous line)
        // For now, default to <ul>
        result.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      result.push(line);
    } else {
      if (inList) {
        result.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
      result.push(line);
    }
  }

  if (inList) {
    result.push(`</${listType}>`);
  }

  return result.join('\n');
}

/**
 * Post-process HTML to fix common issues and convert remaining wikitext
 */
function postProcessHtml(html, originalWikitext) {
  // Handle file/image references
  html = html.replace(/\[\[File:([^\]|]+)(\|[^\]]+)?\]\]/gi, (match, filename, options) => {
    const cleanFilename = filename.trim().replace(/ /g, '_');
    // We'll update these URLs later when files are imported
    return `<img src="/api/v1/files/by-name/${encodeURIComponent(cleanFilename)}" alt="${filename}" class="wiki-image">`;
  });

  // Handle file links [[:File:...]]
  html = html.replace(/\[\[:File:([^\]|]+)(\|([^\]]+))?\]\]/gi, (match, filename, _, label) => {
    const cleanFilename = filename.trim().replace(/ /g, '_');
    const displayLabel = label || filename;
    return `<a href="/api/v1/files/by-name/${encodeURIComponent(cleanFilename)}" class="wiki-file-link">${displayLabel}</a>`;
  });

  // Handle internal wiki links [[Page Name]] or [[Page Name|Label]]
  html = html.replace(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g, (match, pageName, _, label) => {
    const displayLabel = label || pageName;
    const slug = slugify(pageName);
    return `<a href="#page:${slug}" class="wiki-internal-link" data-page="${pageName}">${displayLabel}</a>`;
  });

  // Handle MediaWiki table syntax
  if (originalWikitext.includes('{|')) {
    html = convertWikiTables(html, originalWikitext);
  }

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Clean up multiple line breaks
  html = html.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');

  return html;
}

/**
 * Convert MediaWiki table syntax to HTML
 */
function convertWikiTables(html, wikitext) {
  // Extract tables from original wikitext and convert
  const tablePattern = /\{\|([^]*?)\|\}/g;
  let match;

  while ((match = tablePattern.exec(wikitext)) !== null) {
    const tableWiki = match[0];
    const tableHtml = convertSingleTable(tableWiki);

    // Try to find and replace the table in the HTML
    // This is a best-effort approach
    if (tableHtml) {
      // Just append table at end if we can't find exact placement
      html += '\n' + tableHtml;
    }
  }

  return html;
}

/**
 * Convert a single MediaWiki table to HTML
 */
function convertSingleTable(tableWiki) {
  try {
    const lines = tableWiki.split('\n');
    let html = '<table class="wiki-table">';
    let inRow = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('{|')) {
        // Table start with attributes
        const classMatch = trimmed.match(/class="([^"]+)"/);
        if (classMatch) {
          html = `<table class="${classMatch[1]}">`;
        }
      } else if (trimmed.startsWith('|-')) {
        // Row separator
        if (inRow) {
          html += '</tr>';
        }
        html += '<tr>';
        inRow = true;
      } else if (trimmed.startsWith('!')) {
        // Header cell
        const content = trimmed.substring(1).replace(/^[^|]*\|/, '').trim();
        html += `<th>${content}</th>`;
      } else if (trimmed.startsWith('|') && !trimmed.startsWith('|}')) {
        // Data cell
        const cellContent = trimmed.substring(1);
        // Handle cells with attributes
        const parts = cellContent.split('|');
        const content = parts.length > 1 ? parts.slice(1).join('|').trim() : parts[0].trim();
        html += `<td>${content}</td>`;
      }
    }

    if (inRow) {
      html += '</tr>';
    }
    html += '</table>';

    return html;
  } catch (err) {
    console.warn('Warning: Failed to convert table');
    return null;
  }
}

/**
 * Generate a URL-friendly slug from a title
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 200);
}

// =============================================================================
// XML Parsing
// =============================================================================

/**
 * Parse MediaWiki XML export
 */
async function parseMediaWikiXml(xmlPath) {
  console.log(`Reading XML file: ${xmlPath}`);
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');

  console.log('Parsing XML...');
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
  });

  const result = await parser.parseStringPromise(xmlContent);
  const mediawiki = result.mediawiki;

  // Extract site info
  const siteInfo = mediawiki.siteinfo || {};
  console.log(`Source wiki: ${siteInfo.sitename || 'Unknown'}`);
  console.log(`Generator: ${siteInfo.generator || 'Unknown'}`);

  // Extract pages
  let pages = mediawiki.page || [];
  if (!Array.isArray(pages)) {
    pages = [pages];
  }

  console.log(`Found ${pages.length} pages in export`);

  return { siteInfo, pages };
}

/**
 * Extract categories from a page's wikitext
 */
function extractCategories(wikitext) {
  const categories = [];
  const categoryPattern = /\[\[Category:([^\]|]+)(\|[^\]]+)?\]\]/gi;
  let match;

  while ((match = categoryPattern.exec(wikitext)) !== null) {
    categories.push(match[1].trim());
  }

  return categories;
}

/**
 * Infer section from page title when no categories exist
 * This provides better organization for wikis without formal categories
 */
function inferSectionFromTitle(title) {
  // Pattern matching rules for common MOBIUS Wiki page prefixes
  const patterns = [
    { pattern: /^7\.\d+\s+DCB/i, section: 'DCB Admin' },
    { pattern: /^7\.\d+/i, section: 'OpenRS Documentation' },
    { pattern: /^7\s+DCB/i, section: 'DCB Admin' },
    { pattern: /^7\s+FOLIO/i, section: 'FOLIO Training' },
    { pattern: /^DCB/i, section: 'DCB Documentation' },
    { pattern: /^FOLIO/i, section: 'FOLIO Documentation' },
    { pattern: /^OpenRS/i, section: 'OpenRS Documentation' },
    { pattern: /^EDS|^EBSCO/i, section: 'EBSCO/EDS' },
    { pattern: /^Label\s*Maker/i, section: 'Label Maker' },
    { pattern: /training/i, section: 'Training' },
    { pattern: /^Locate/i, section: 'Locate' },
    { pattern: /^Controlling\s+Lending/i, section: 'Lending Controls' },
    { pattern: /^Inventory|^Bulk\s*Edit|^Lists/i, section: 'FOLIO Inventory' },
    { pattern: /^Course\s*Reserves/i, section: 'Course Reserves' },
    { pattern: /^Finance|^Acquisitions/i, section: 'Finance & Acquisitions' },
    { pattern: /^Guidelines/i, section: 'Guidelines' },
    { pattern: /^Connexion|^OCLC/i, section: 'OCLC/Connexion' },
    { pattern: /^Jira/i, section: 'JIRA' },
    { pattern: /^20\d{6}/i, section: 'Dated Documentation' }, // Pages starting with dates like 20250506
  ];

  for (const { pattern, section } of patterns) {
    if (pattern.test(title)) {
      return section;
    }
  }

  return 'General';
}

/**
 * Get page content from revision(s)
 */
function getPageRevisions(page) {
  let revisions = page.revision || [];
  if (!Array.isArray(revisions)) {
    revisions = [revisions];
  }

  return revisions.map(rev => {
    const text = rev.text;
    const content = typeof text === 'object' ? (text._ || text['$t'] || '') : (text || '');

    return {
      id: rev.id,
      parentId: rev.parentid,
      timestamp: rev.timestamp,
      contributor: rev.contributor?.username || rev.contributor?.ip || 'Anonymous',
      content: content,
      sha1: rev.sha1,
    };
  }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); // Sort oldest first
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Create the target wiki
 *
 * Matches existing wikis by slug OR title (case-insensitive) to prevent duplicates.
 *
 * @param {object} client - Database client
 * @param {string} title - Wiki title
 * @param {number} userId - User ID for attribution
 * @param {string} [description] - Wiki description
 * @param {string} [customSlug] - Optional custom slug
 * @returns {Promise<number>} - Wiki ID
 */
async function createWiki(client, title, userId, description, customSlug) {
  const slug = customSlug || slugify(title);

  // Check if wiki exists by slug OR title (case-insensitive) to prevent duplicates
  const existing = await client.query(
    `SELECT id, title, slug FROM wiki.wikis
     WHERE (slug = $1 OR LOWER(title) = LOWER($2))
       AND deleted_at IS NULL`,
    [slug, title]
  );

  if (existing.rows.length > 0) {
    const existingWiki = existing.rows[0];
    console.log(`Wiki "${title}" already exists (id: ${existingWiki.id}, slug: ${existingWiki.slug})`);

    // Update the wiki if title/slug changed
    if (existingWiki.slug !== slug || existingWiki.title !== title) {
      await client.query(
        `UPDATE wiki.wikis
         SET title = $1, slug = $2, updated_at = NOW()
         WHERE id = $3`,
        [title, slug, existingWiki.id]
      );
      console.log(`  Updated wiki: title="${title}", slug="${slug}"`);
    }

    return existingWiki.id;
  }

  const desc = description || `Imported from MediaWiki on ${new Date().toISOString()}`;

  const result = await client.query(
    `INSERT INTO wiki.wikis (title, slug, description, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $4)
     RETURNING id`,
    [title, slug, desc, userId]
  );

  console.log(`Created wiki "${title}" (id: ${result.rows[0].id})`);
  return result.rows[0].id;
}

/**
 * Create or get a section
 *
 * @param {object} client - Database client
 * @param {number} wikiId - Wiki ID
 * @param {string} title - Section title
 * @param {number} userId - User ID for attribution
 * @param {number} sortOrder - Sort order for the section (unique per wiki)
 * @returns {Promise<number>} - Section ID
 */
async function getOrCreateSection(client, wikiId, title, userId, sortOrder = 0) {
  const slug = slugify(title);

  const existing = await client.query(
    'SELECT id FROM wiki.sections WHERE wiki_id = $1 AND slug = $2 AND deleted_at IS NULL',
    [wikiId, slug]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const result = await client.query(
    `INSERT INTO wiki.sections (wiki_id, title, slug, sort_order, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     RETURNING id`,
    [wikiId, title, slug, sortOrder, userId]
  );

  console.log(`  Created section: ${title} (sort_order: ${sortOrder})`);
  return result.rows[0].id;
}

/**
 * Import a single page with its revision history
 */
async function importPage(client, sectionId, page, userId, stats) {
  const title = page.title;
  const ns = parseInt(page.ns) || 0;
  const slug = slugify(title);

  // Get revisions
  const revisions = getPageRevisions(page);
  if (revisions.length === 0) {
    console.log(`  Skip (no content): ${title}`);
    stats.skipped++;
    return;
  }

  // Get latest revision for current content
  const latestRevision = revisions[revisions.length - 1];
  const content = wikitextToHtml(latestRevision.content, title);
  const categories = extractCategories(latestRevision.content);

  // Check if page already exists in this section
  const existing = await client.query(
    'SELECT id FROM wiki.pages WHERE section_id = $1 AND slug = $2 AND deleted_at IS NULL',
    [sectionId, slug]
  );

  if (existing.rows.length > 0) {
    console.log(`  Skip (exists): ${title}`);
    stats.skipped++;
    return;
  }

  // Create the page
  const pageResult = await client.query(
    `INSERT INTO wiki.pages (section_id, title, slug, content, status, created_at, updated_at, created_by, updated_by)
     VALUES ($1, $2, $3, $4, 'published', $5, $6, $7, $7)
     RETURNING id`,
    [
      sectionId,
      title,
      slug,
      content,
      latestRevision.timestamp ? new Date(latestRevision.timestamp) : new Date(),
      latestRevision.timestamp ? new Date(latestRevision.timestamp) : new Date(),
      userId
    ]
  );
  const pageId = pageResult.rows[0].id;

  // Import all revisions as page_versions
  for (let i = 0; i < revisions.length; i++) {
    const rev = revisions[i];
    const versionNumber = i + 1;
    const versionContent = wikitextToHtml(rev.content, title);

    await client.query(
      `INSERT INTO wiki.page_versions (page_id, content, title, version_number, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        pageId,
        versionContent,
        title,
        versionNumber,
        rev.timestamp ? new Date(rev.timestamp) : new Date(),
        userId
      ]
    );
  }

  if (config.verbose) {
    console.log(`  Imported: ${title} (${revisions.length} revisions, ${categories.length} categories)`);
  }
  stats.imported++;
  stats.revisions += revisions.length;

  return { pageId, categories };
}

// =============================================================================
// Main Import Function
// =============================================================================

/**
 * Analyze pages and determine wiki assignments for multi-wiki mode.
 *
 * @param {Array} mainPages - Pages to analyze
 * @returns {Map} - Map of wikiKey -> array of { page, section, method }
 */
function analyzeMultiWikiAssignments(mainPages) {
  const wikiAssignments = new Map();

  // Initialize all wikis
  for (const wikiKey of Object.keys(WIKI_CONFIGS)) {
    wikiAssignments.set(wikiKey, []);
  }

  for (const page of mainPages) {
    const revisions = getPageRevisions(page);
    if (revisions.length === 0) continue;

    const latestContent = revisions[revisions.length - 1].content;
    const { wikiKey, method } = determineWikiAssignment(page.title, latestContent);
    const section = inferSectionForWiki(page.title, wikiKey);

    wikiAssignments.get(wikiKey).push({
      page,
      section,
      method,
      revisionCount: revisions.length,
    });
  }

  return wikiAssignments;
}

/**
 * Get method indicator for display
 */
function getMethodIndicator(method) {
  switch (method) {
    case 'booknav': return '[B]';
    case 'title': return '[T]';
    case 'default': return '[D]';
    default: return '[?]';
  }
}

async function main() {
  const isMultiWikiMode = !config.singleWikiTitle;

  console.log('='.repeat(70));
  console.log('MediaWiki to MOBIUS Wiki Import');
  console.log('='.repeat(70));
  console.log(`XML File: ${config.xmlPath}`);
  console.log(`Mode: ${isMultiWikiMode ? 'Multi-Wiki (FOLIO, EDS, OpenRS, Panorama)' : `Single Wiki: ${config.singleWikiTitle}`}`);
  console.log(`Files: ${config.filesPath || 'Not specified'}`);
  console.log(`User ID: ${config.userId}`);
  console.log(`Dry Run: ${config.dryRun}`);
  console.log('');

  // Verify XML file exists
  const absolutePath = path.resolve(config.xmlPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: XML file not found: ${absolutePath}`);
    process.exit(1);
  }

  // Parse XML
  const { pages } = await parseMediaWikiXml(absolutePath);

  // Filter out non-main namespace pages
  const mainPages = pages.filter(p => {
    const ns = parseInt(p.ns) || 0;
    return !config.skipNamespaces.includes(ns);
  });

  console.log(`Filtered to ${mainPages.length} main namespace pages`);
  console.log('');

  // Stats tracking
  const stats = {
    imported: 0,
    skipped: 0,
    failed: 0,
    revisions: 0,
    sections: 0,
    wikis: 0,
  };

  // ============================================================================
  // Multi-Wiki Mode
  // ============================================================================
  if (isMultiWikiMode) {
    console.log('Analyzing page assignments...');
    const wikiAssignments = analyzeMultiWikiAssignments(mainPages);

    // Count assignments by method
    const methodCounts = { booknav: 0, title: 0, default: 0 };
    for (const [, pageList] of wikiAssignments) {
      for (const { method } of pageList) {
        methodCounts[method]++;
      }
    }

    console.log(`\nAssignment methods: [B]ooknav=${methodCounts.booknav}, [T]itle=${methodCounts.title}, [D]efault=${methodCounts.default}`);
    console.log('');

    // Dry run output
    if (config.dryRun) {
      console.log('='.repeat(70));
      console.log('DRY RUN - No changes will be made');
      console.log('='.repeat(70));

      for (const wikiKey of WIKI_CHECK_ORDER) {
        const wikiConfig = WIKI_CONFIGS[wikiKey];
        const pageList = wikiAssignments.get(wikiKey);

        if (pageList.length === 0) {
          console.log(`\n📁 ${wikiConfig.title} (0 pages) - Would skip, no pages`);
          continue;
        }

        console.log(`\n📁 ${wikiConfig.title} (${pageList.length} pages)`);

        // Group by section
        const sectionGroups = new Map();
        for (const item of pageList) {
          if (!sectionGroups.has(item.section)) {
            sectionGroups.set(item.section, []);
          }
          sectionGroups.get(item.section).push(item);
        }

        // Print sections and pages
        for (const [section, items] of sectionGroups) {
          console.log(`  📂 ${section} (${items.length} pages)`);
          for (const item of items) {
            const indicator = getMethodIndicator(item.method);
            console.log(`     ${indicator} ${item.page.title} (${item.revisionCount} rev)`);
          }
        }
      }

      console.log('\n' + '='.repeat(70));
      console.log('Legend: [B]=Booknav tag, [T]=Title pattern, [D]=Default');
      console.log('Remove --dry-run to perform actual import');
      return;
    }

    // Actual import
    console.log('Connecting to database...');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create wikis and import pages
      for (const wikiKey of WIKI_CHECK_ORDER) {
        const wikiConfig = WIKI_CONFIGS[wikiKey];
        const pageList = wikiAssignments.get(wikiKey);

        if (pageList.length === 0) {
          console.log(`\nSkipping ${wikiConfig.title} wiki (no pages)`);
          continue;
        }

        console.log(`\n${'─'.repeat(70)}`);
        console.log(`Creating ${wikiConfig.title} wiki with ${pageList.length} pages...`);

        // Create wiki
        const wikiId = await createWiki(
          client,
          wikiConfig.title,
          config.userId,
          wikiConfig.description,
          wikiConfig.slug
        );
        stats.wikis++;

        // Group pages by section
        const sectionGroups = new Map();
        for (const item of pageList) {
          if (!sectionGroups.has(item.section)) {
            sectionGroups.set(item.section, []);
          }
          sectionGroups.get(item.section).push(item);
        }

        // Create sections and import pages
        const sectionMap = new Map();
        let sectionSortOrder = 0;

        // Always create General section as fallback (sort_order 0)
        const generalId = await getOrCreateSection(client, wikiId, 'General', config.userId, sectionSortOrder++);
        sectionMap.set('General', generalId);
        stats.sections++;

        for (const [sectionName, items] of sectionGroups) {
          if (sectionName !== 'General') {
            const sectionId = await getOrCreateSection(client, wikiId, sectionName, config.userId, sectionSortOrder++);
            sectionMap.set(sectionName, sectionId);
            stats.sections++;
          }
        }

        console.log(`Created ${sectionGroups.size} sections`);
        console.log('Importing pages...');

        // Import pages in this wiki
        let wikiPageCount = 0;
        for (const item of pageList) {
          wikiPageCount++;
          const sectionId = sectionMap.get(item.section) || generalId;

          try {
            if (!config.verbose) {
              process.stdout.write(`\r  [${wikiPageCount}/${pageList.length}] ${item.page.title.substring(0, 45).padEnd(45)}`);
            } else {
              console.log(`  [${wikiPageCount}/${pageList.length}] ${item.page.title}`);
            }

            await importPage(client, sectionId, item.page, config.userId, stats);
          } catch (err) {
            console.log(`\n  Error importing "${item.page.title}": ${err.message}`);
            stats.failed++;
          }
        }
        console.log(''); // New line after progress
      }

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
    console.log('MULTI-WIKI IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`Wikis created: ${stats.wikis}`);
    console.log(`Sections created: ${stats.sections}`);
    console.log(`Pages imported: ${stats.imported}`);
    console.log(`Pages skipped: ${stats.skipped}`);
    console.log(`Pages failed: ${stats.failed}`);
    console.log(`Revisions imported: ${stats.revisions}`);
    console.log('');

    if (config.filesPath) {
      console.log('Note: File references in page content point to /api/v1/files/by-name/');
      console.log('Make sure to import files from:', config.filesPath);
    }

    await pool.end();
    return;
  }

  // ============================================================================
  // Single-Wiki Mode (Legacy)
  // ============================================================================

  // Extract all categories for section creation (legacy behavior)
  const allCategories = new Set();
  const allInferredSections = new Set();
  const pageCategories = new Map();
  const pageSections = new Map();

  for (const page of mainPages) {
    const revisions = getPageRevisions(page);
    if (revisions.length > 0) {
      const latestContent = revisions[revisions.length - 1].content;
      const categories = extractCategories(latestContent);
      pageCategories.set(page.title, categories);
      categories.forEach(cat => allCategories.add(cat));

      const inferredSection = inferSectionFromTitle(page.title);
      pageSections.set(page.title, inferredSection);
      allInferredSections.add(inferredSection);
    }
  }

  console.log(`Found ${allCategories.size} unique categories`);
  console.log(`Inferred ${allInferredSections.size} sections from titles`);
  if (allCategories.size > 0 && config.verbose) {
    console.log('Categories:', Array.from(allCategories).join(', '));
  }
  console.log('');

  if (config.dryRun) {
    console.log('='.repeat(70));
    console.log('DRY RUN - No changes will be made');
    console.log('='.repeat(70));

    console.log('\nWould create wiki:', config.singleWikiTitle);
    console.log('\nWould create sections:');
    const sectionsToCreate = allCategories.size > 0 ? allCategories : allInferredSections;
    Array.from(sectionsToCreate).sort().forEach(s => console.log(`  - ${s}`));

    console.log(`\nWould import ${mainPages.length} pages:`);
    mainPages.forEach(p => {
      const revisions = getPageRevisions(p);
      const cats = pageCategories.get(p.title) || [];
      const section = cats.length > 0 ? cats[0] : (pageSections.get(p.title) || 'General');
      console.log(`  - ${p.title} (${revisions.length} revisions) -> ${section}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('Remove --dry-run to perform actual import');
    return;
  }

  // Connect to database
  console.log('Connecting to database...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const wikiId = await createWiki(client, config.singleWikiTitle, config.userId);
    stats.wikis++;

    const sectionMap = new Map();
    const sectionsToCreate = allCategories.size > 0 ? allCategories : allInferredSections;
    let sectionSortOrder = 0;

    const fallbackSectionName = allCategories.size > 0 ? 'Uncategorized' : 'General';
    const fallbackId = await getOrCreateSection(client, wikiId, fallbackSectionName, config.userId, sectionSortOrder++);
    sectionMap.set(fallbackSectionName, fallbackId);
    stats.sections++;

    for (const sectionName of sectionsToCreate) {
      if (sectionName !== fallbackSectionName) {
        const sectionId = await getOrCreateSection(client, wikiId, sectionName, config.userId, sectionSortOrder++);
        sectionMap.set(sectionName, sectionId);
        stats.sections++;
      }
    }

    console.log(`\nCreated ${stats.sections} sections`);
    console.log('\nImporting pages...');
    console.log('-'.repeat(70));

    for (let i = 0; i < mainPages.length; i++) {
      const page = mainPages[i];
      const progress = `[${i + 1}/${mainPages.length}]`;

      try {
        const categories = pageCategories.get(page.title) || [];
        let sectionName;
        if (categories.length > 0) {
          sectionName = categories[0];
        } else {
          sectionName = pageSections.get(page.title) || fallbackSectionName;
        }
        const sectionId = sectionMap.get(sectionName) || fallbackId;

        if (!config.verbose) {
          process.stdout.write(`\r${progress} ${page.title.substring(0, 50).padEnd(50)}`);
        } else {
          console.log(`${progress} ${page.title}`);
        }

        await importPage(client, sectionId, page, config.userId, stats);
      } catch (err) {
        console.log(`\n  Error importing "${page.title}": ${err.message}`);
        stats.failed++;
      }
    }

    console.log('\n');

    await client.query('COMMIT');
    console.log('Transaction committed successfully.');

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
  console.log(`Wiki: ${config.singleWikiTitle}`);
  console.log(`Sections created: ${stats.sections}`);
  console.log(`Pages imported: ${stats.imported}`);
  console.log(`Pages skipped: ${stats.skipped}`);
  console.log(`Pages failed: ${stats.failed}`);
  console.log(`Revisions imported: ${stats.revisions}`);
  console.log('');

  if (config.filesPath) {
    console.log('Note: File references in page content point to /api/v1/files/by-name/');
    console.log('Make sure to import files from:', config.filesPath);
  }

  await pool.end();
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
