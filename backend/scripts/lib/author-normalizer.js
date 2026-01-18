/**
 * author-normalizer.js
 *
 * Normalizes git author names/emails to consistent wiki user identities.
 * Maps various git author formats to canonical user records.
 */

// Mapping of git author signatures to normalized user data
const AUTHOR_MAP = {
  // Ted Peterson - 266 commits
  'Ted Peterson <ted@mobiusconsortium.org>': {
    name: 'Ted Peterson',
    email: 'ted@mobiusconsortium.org'
  },
  'Ted P <ted@mobiusconsortium.org>': {
    name: 'Ted Peterson',
    email: 'ted@mobiusconsortium.org'
  },

  // Blake - 369 commits (246 + 123)
  'bmagic007 <blake@mobiusconsortium.org>': {
    name: 'Blake',
    email: 'blake@mobiusconsortium.org'
  },
  'blake <blake@mobiusconsortium.org>': {
    name: 'Blake',
    email: 'blake@mobiusconsortium.org'
  },

  // Christopher Gould - 57 commits (35 + 21 + 3)
  'Christopher <christopher@mobiusconsortium.org>': {
    name: 'Christopher Gould',
    email: 'christopher@mobiusconsortium.org'
  },
  'Christopher Gould <christopher@mobiusconsortium.org>': {
    name: 'Christopher Gould',
    email: 'christopher@mobiusconsortium.org'
  },
  'Christopher Gould <Christopher@mobius.office>': {
    name: 'Christopher Gould',
    email: 'christopher@mobiusconsortium.org'
  },

  // Adrienne Detwiler - 33+ commits
  'Adrienne Detwiler <adrienne@mobiusconsortium.org>': {
    name: 'Adrienne Detwiler',
    email: 'adrienne@mobiusconsortium.org'
  },
  'adetwile <adetwile@mobiusconsortium.org>': {
    name: 'Adrienne Detwiler',
    email: 'adrienne@mobiusconsortium.org'
  },

  // Jaysal Patel - 41 commits (21 + 20)
  'Jaysal Patel <jaysal@mobiusconsortium.org>': {
    name: 'Jaysal Patel',
    email: 'jaysal@mobiusconsortium.org'
  },
  'Jaysal <jaysal@mobiusconsortium.org>': {
    name: 'Jaysal Patel',
    email: 'jaysal@mobiusconsortium.org'
  },

  // Scott - 13 commits (9 + 2 + 1 + 1)
  'Scott Peterson <scott@mobiusconsortium.org>': {
    name: 'Scott Peterson',
    email: 'scott@mobiusconsortium.org'
  },
  'Scott Angel <angelwilliamscott@gmail.com>': {
    name: 'Scott Peterson',
    email: 'scott@mobiusconsortium.org'
  },
  'Scott Angel <scottangel@mobiusconsortium.org>': {
    name: 'Scott Peterson',
    email: 'scott@mobiusconsortium.org'
  },
  'Scott Peterson <Scott@mobius.office>': {
    name: 'Scott Peterson',
    email: 'scott@mobiusconsortium.org'
  },

  // Debbie Luchenbill - 4 commits (3 + 1)
  'debbie <debbie@mobiusconsortium.org>': {
    name: 'Debbie Luchenbill',
    email: 'debbie@mobiusconsortium.org'
  },
  'Debbie Luchenbill <debbie@mobiusconsortium.org>': {
    name: 'Debbie Luchenbill',
    email: 'debbie@mobiusconsortium.org'
  },
};

// System accounts that should be attributed to admin user
const SYSTEM_AUTHORS = [
  'MOBIUS Admin <mcoia@mobiusconsortium.org>',
  'MOBIUS docs <docs@mobiusconsortium.org>',
  'checkoutuser <just_need_to_satisfy_git@yoyo.com>',
  'docs server <you@example.com>',
];

/**
 * Normalize a git author to a canonical user identity
 * @param {string} authorName - Git author name
 * @param {string} authorEmail - Git author email
 * @returns {{ name: string, email: string, isSystem: boolean }}
 */
function normalizeAuthor(authorName, authorEmail) {
  const signature = `${authorName} <${authorEmail}>`;

  // Check if it's a system account
  if (SYSTEM_AUTHORS.includes(signature)) {
    return { name: 'System', email: 'system@mobiusconsortium.org', isSystem: true };
  }

  // Check for mapped author
  if (AUTHOR_MAP[signature]) {
    return { ...AUTHOR_MAP[signature], isSystem: false };
  }

  // Fallback: use the git author as-is but clean up email domain
  const email = authorEmail.toLowerCase();
  return {
    name: authorName,
    email: email.includes('@mobiusconsortium.org') ? email : `${authorName.toLowerCase().replace(/\s+/g, '.')}@mobiusconsortium.org`,
    isSystem: false
  };
}

/**
 * Get all unique normalized users from the author map
 * @returns {Array<{ name: string, email: string }>}
 */
function getAllNormalizedUsers() {
  const seen = new Set();
  const users = [];

  for (const userData of Object.values(AUTHOR_MAP)) {
    if (!seen.has(userData.email)) {
      seen.add(userData.email);
      users.push({ ...userData });
    }
  }

  return users;
}

/**
 * Check if an author signature is a known system account
 * @param {string} authorName
 * @param {string} authorEmail
 * @returns {boolean}
 */
function isSystemAuthor(authorName, authorEmail) {
  const signature = `${authorName} <${authorEmail}>`;
  return SYSTEM_AUTHORS.includes(signature);
}

module.exports = {
  AUTHOR_MAP,
  SYSTEM_AUTHORS,
  normalizeAuthor,
  getAllNormalizedUsers,
  isSystemAuthor,
};
