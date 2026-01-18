#!/usr/bin/env node
/**
 * generate-migration-users.js
 *
 * Scans git history from resources/docs/ and generates a SQL file
 * to create user accounts for all document authors.
 *
 * Usage:
 *   node scripts/generate-migration-users.js
 *   node scripts/generate-migration-users.js --dry-run
 *
 * Output:
 *   migration-data/users.sql
 */

const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');

const { createGitInstance, isValidRepo } = require('./lib/git-history-walker');
const { normalizeAuthor, getAllNormalizedUsers, isSystemAuthor } = require('./lib/author-normalizer');

// Paths
const DOCS_ROOT = path.join(__dirname, '../../resources/docs');
const OUTPUT_DIR = path.join(__dirname, '../migration-data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'users.sql');

// Default password for all migrated users (they should change this!)
const DEFAULT_PASSWORD = 'changeme123!';
const BCRYPT_ROUNDS = 12;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('=== MOBIUS Documentation User Migration ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no files written)' : 'LIVE'}`);

  // Initialize git
  const git = createGitInstance(DOCS_ROOT);

  if (!await isValidRepo(git)) {
    console.error(`ERROR: ${DOCS_ROOT} is not a valid git repository`);
    process.exit(1);
  }

  console.log(`\nScanning git repository: ${DOCS_ROOT}`);

  // Get all unique authors from git history
  const authorsFromGit = await scanGitAuthors(git);
  console.log(`\nFound ${authorsFromGit.size} unique git author signatures`);

  // Normalize authors
  const normalizedUsers = new Map();
  const systemCommitCount = { count: 0 };

  for (const [signature, commitCount] of authorsFromGit) {
    const [name, email] = parseSignature(signature);
    const normalized = normalizeAuthor(name, email);

    if (normalized.isSystem) {
      systemCommitCount.count += commitCount;
      continue;
    }

    if (!normalizedUsers.has(normalized.email)) {
      normalizedUsers.set(normalized.email, {
        ...normalized,
        commitCount: 0,
        variants: []
      });
    }

    const user = normalizedUsers.get(normalized.email);
    user.commitCount += commitCount;
    user.variants.push(signature);
  }

  console.log(`\nNormalized to ${normalizedUsers.size} unique users:`);
  console.log(`  (${systemCommitCount.count} commits from system accounts will be attributed to admin)\n`);

  // Print user summary
  const users = Array.from(normalizedUsers.values()).sort((a, b) => b.commitCount - a.commitCount);

  for (const user of users) {
    console.log(`  ${user.name} <${user.email}>`);
    console.log(`    Commits: ${user.commitCount}`);
    if (user.variants.length > 1) {
      console.log(`    Git variants: ${user.variants.join(', ')}`);
    }
    console.log();
  }

  if (dryRun) {
    console.log('DRY RUN - No files written');
    return;
  }

  // Generate password hash
  console.log('Generating password hash...');
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // Generate SQL file
  console.log('Generating SQL file...');
  const sql = generateSql(users, passwordHash);

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Write SQL file
  await fs.writeFile(OUTPUT_FILE, sql, 'utf8');
  console.log(`\nWritten: ${OUTPUT_FILE}`);

  // Also generate a summary JSON for reference
  const summaryFile = path.join(OUTPUT_DIR, 'users-summary.json');
  const summary = {
    generatedAt: new Date().toISOString(),
    totalUsers: users.length,
    totalCommits: users.reduce((sum, u) => sum + u.commitCount, 0),
    systemCommits: systemCommitCount.count,
    users: users.map(u => ({
      name: u.name,
      email: u.email,
      commitCount: u.commitCount,
      variants: u.variants
    }))
  };
  await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`Written: ${summaryFile}`);

  console.log('\n=== Complete ===');
  console.log(`\nTo import users, run:`);
  console.log(`  cd backend && npm run sql -- --file migration-data/users.sql`);
  console.log(`\nIMPORTANT: Users will have password "${DEFAULT_PASSWORD}" - they should change it!`);
}

/**
 * Scan git history for all unique author signatures
 * @param {import('simple-git').SimpleGit} git
 * @returns {Promise<Map<string, number>>} Map of signature -> commit count
 */
async function scanGitAuthors(git) {
  const authors = new Map();

  try {
    // Get all commits with author info
    const result = await git.raw([
      'log',
      '--format=%an <%ae>',
      '--all'
    ]);

    for (const line of result.trim().split('\n')) {
      if (!line) continue;
      authors.set(line, (authors.get(line) || 0) + 1);
    }
  } catch (err) {
    console.error('Error scanning git authors:', err.message);
  }

  return authors;
}

/**
 * Parse a git signature into name and email
 * @param {string} signature - Format: "Name <email>"
 * @returns {[string, string]}
 */
function parseSignature(signature) {
  const match = signature.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return [match[1].trim(), match[2].trim()];
  }
  return [signature, ''];
}

/**
 * Generate SQL INSERT statements for users
 * @param {Array<{name: string, email: string, commitCount: number}>} users
 * @param {string} passwordHash
 * @returns {string}
 */
function generateSql(users, passwordHash) {
  const lines = [
    '-- ==============================================',
    '-- MOBIUS Documentation Migration - User Accounts',
    '-- ==============================================',
    `-- Generated: ${new Date().toISOString()}`,
    '-- ',
    '-- WARNING: This file contains PII (names and email addresses)',
    '-- DO NOT commit this file to the git repository!',
    '-- ',
    `-- Default password for all users: changeme123!`,
    '-- Users should change their password after first login.',
    '-- ==============================================',
    '',
    '-- Insert users (skip if email already exists)',
    'INSERT INTO wiki.users (email, password_hash, name, role, is_active, created_by, created_at, updated_at)',
    'VALUES'
  ];

  const valueLines = users.map((user, index) => {
    const isLast = index === users.length - 1;
    const email = escapeSql(user.email);
    const name = escapeSql(user.name);
    return `  ('${email}', '${passwordHash}', '${name}', 'mobius_staff', true, 1, NOW(), NOW())${isLast ? '' : ','}`;
  });

  lines.push(...valueLines);
  lines.push('ON CONFLICT (email) DO NOTHING;');
  lines.push('');
  lines.push('-- Summary:');
  lines.push(`-- Total users: ${users.length}`);
  lines.push(`-- Total commits: ${users.reduce((sum, u) => sum + u.commitCount, 0)}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Escape single quotes for SQL
 * @param {string} str
 * @returns {string}
 */
function escapeSql(str) {
  return str.replace(/'/g, "''");
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
