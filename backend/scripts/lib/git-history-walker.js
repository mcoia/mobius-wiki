/**
 * git-history-walker.js
 *
 * Utilities for walking git history efficiently using simple-git.
 * Handles file renames and extracts content at specific commits.
 */

const simpleGit = require('simple-git');
const path = require('path');

/**
 * Create a git instance for the docs repository
 * @param {string} repoPath - Path to the git repository
 * @returns {import('simple-git').SimpleGit}
 */
function createGitInstance(repoPath) {
  return simpleGit(repoPath);
}

/**
 * Get the full commit history for a file, following renames
 * @param {import('simple-git').SimpleGit} git - Git instance
 * @param {string} filePath - Path to the file (relative to repo root)
 * @returns {Promise<Array<{
 *   hash: string,
 *   date: string,
 *   authorName: string,
 *   authorEmail: string,
 *   message: string
 * }>>}
 */
async function getFileHistory(git, filePath) {
  try {
    // Use raw git log to get full history with follows
    const logResult = await git.raw([
      'log',
      '--follow',
      '--pretty=format:%H|%aI|%an|%ae|%s',
      '--',
      filePath
    ]);

    if (!logResult || logResult.trim() === '') {
      return [];
    }

    const commits = logResult.trim().split('\n').map(line => {
      const [hash, date, authorName, authorEmail, ...messageParts] = line.split('|');
      return {
        hash,
        date,
        authorName,
        authorEmail,
        message: messageParts.join('|') // In case message contains |
      };
    });

    // Reverse to get chronological order (oldest first)
    return commits.reverse();
  } catch (err) {
    console.error(`Error getting history for ${filePath}:`, err.message);
    return [];
  }
}

/**
 * Get the content of a file at a specific commit
 * @param {import('simple-git').SimpleGit} git - Git instance
 * @param {string} commitHash - The commit hash
 * @param {string} filePath - Path to the file (relative to repo root)
 * @returns {Promise<string|null>} - File content or null if not found
 */
async function getFileAtCommit(git, commitHash, filePath) {
  try {
    const content = await git.show([`${commitHash}:${filePath}`]);
    return content;
  } catch (err) {
    // File might have been renamed or doesn't exist at this commit
    // Try to find the file path at this commit
    try {
      const diffTree = await git.raw([
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        commitHash
      ]);

      // Look for .adoc files that might be the renamed version
      const adocFiles = diffTree.trim().split('\n').filter(f => f.endsWith('.adoc'));
      const baseName = path.basename(filePath);

      for (const f of adocFiles) {
        if (path.basename(f) === baseName) {
          try {
            const content = await git.show([`${commitHash}:${f}`]);
            return content;
          } catch {
            continue;
          }
        }
      }
    } catch {
      // Ignore errors in fallback
    }

    return null;
  }
}

/**
 * Get all commits that touched any .adoc file
 * @param {import('simple-git').SimpleGit} git - Git instance
 * @param {string} subPath - Optional subdirectory to filter
 * @returns {Promise<Array<{
 *   hash: string,
 *   date: string,
 *   authorName: string,
 *   authorEmail: string,
 *   message: string,
 *   files: string[]
 * }>>}
 */
async function getAllAdocCommits(git, subPath = '') {
  try {
    const logResult = await git.raw([
      'log',
      '--pretty=format:%H|%aI|%an|%ae|%s',
      '--name-only',
      '--',
      subPath ? `${subPath}/**/*.adoc` : '**/*.adoc'
    ]);

    if (!logResult || logResult.trim() === '') {
      return [];
    }

    const commits = [];
    const blocks = logResult.trim().split('\n\n');

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 1) continue;

      const [hash, date, authorName, authorEmail, ...messageParts] = lines[0].split('|');
      const files = lines.slice(1).filter(f => f.endsWith('.adoc'));

      commits.push({
        hash,
        date,
        authorName,
        authorEmail,
        message: messageParts.join('|'),
        files
      });
    }

    return commits.reverse(); // Chronological order
  } catch (err) {
    console.error('Error getting all adoc commits:', err.message);
    return [];
  }
}

/**
 * Get the first commit hash for the repository
 * @param {import('simple-git').SimpleGit} git - Git instance
 * @returns {Promise<string|null>}
 */
async function getFirstCommit(git) {
  try {
    const result = await git.raw(['rev-list', '--max-parents=0', 'HEAD']);
    return result.trim().split('\n')[0] || null;
  } catch (err) {
    console.error('Error getting first commit:', err.message);
    return null;
  }
}

/**
 * Check if the repository is valid and accessible
 * @param {import('simple-git').SimpleGit} git - Git instance
 * @returns {Promise<boolean>}
 */
async function isValidRepo(git) {
  try {
    await git.status();
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  createGitInstance,
  getFileHistory,
  getFileAtCommit,
  getAllAdocCommits,
  getFirstCommit,
  isValidRepo,
};
