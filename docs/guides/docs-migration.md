# AsciiDoc Documentation Migration Guide

This guide documents the migration of MOBIUS internal documentation from AsciiDoc files (Antora-based) into the MOBIUS Wiki system.

## Overview

The migration imports documentation from the `resources/docs/` git repository into the wiki, preserving:

- **Full git history** as page versions (oldest to newest)
- **Author attribution** from git commits
- **Images** with proper URL rewriting
- **Document structure** mapped to wiki sections

### Source Data

| Item | Details |
|------|---------|
| Location | `resources/docs/base_docs/docs/modules/*/pages/` |
| Format | AsciiDoc (.adoc) files |
| Files | ~145 documents |
| Images | ~590 files in `*/assets/images/` |
| Git History | 913 commits, 8 human authors |

### Target Structure

| Item | Details |
|------|---------|
| Wiki | "MOBIUS Documentation" (slug: `mobius-documentation`) |
| Sections | 7 sections mapped from Antora modules |
| Pages | One per .adoc file with version history |

## Migration Scripts

All scripts are located in `backend/scripts/`.

### Main Scripts

| Script | Purpose |
|--------|---------|
| `migrate-docs.js` | Main migration - converts AsciiDoc to HTML, creates pages with version history |
| `import-docs-images.js` | Imports images and resolves `{{IMAGE:...}}` placeholders in content |
| `generate-migration-users.js` | Creates user accounts from git authors |
| `rollback-docs-migration.js` | Undo migration - deletes pages, files, and optionally users |

### Library Utilities

| Script | Purpose |
|--------|---------|
| `lib/asciidoc-converter.js` | Converts AsciiDoc to HTML, strips Antora directives, creates image placeholders |
| `lib/author-normalizer.js` | Maps git author name variants to canonical user identities |
| `lib/git-history-walker.js` | Walks git history for a file, extracting versions oldest-to-newest |

## Usage Workflow

### Prerequisites

```bash
cd backend
npm install  # Ensures asciidoctor and simple-git are installed
```

### Step 1: Take Database Snapshot (Safety)

```bash
npm run db:snapshot save pre-docs-migration
```

### Step 2: Generate User Accounts (Optional)

If you want to create user accounts for git authors:

```bash
node scripts/generate-migration-users.js
```

This creates `migration-data/users.sql` with INSERT statements. Review and run:

```bash
npm run sql -- --file migration-data/users.sql
```

**Note:** The `migration-data/` directory is gitignored because it contains PII.

### Step 3: Dry Run Migration

Preview what will be migrated without making changes:

```bash
node scripts/migrate-docs.js --dry-run
```

### Step 4: Run Migration

```bash
node scripts/migrate-docs.js
```

The script will:
1. Create the "MOBIUS Documentation" wiki (if not exists)
2. Create sections for each Antora module
3. For each .adoc file:
   - Walk git history from oldest to newest commit
   - Convert each version's AsciiDoc to HTML
   - Create the page (first version) or add page versions (subsequent commits)

### Step 5: Import Images

```bash
node scripts/import-docs-images.js
```

This script:
1. Discovers all images in `resources/docs/base_docs/docs/modules/*/assets/images/`
2. Copies them to `backend/uploads/docs-migration/`
3. Inserts file records into the database
4. Resolves `{{IMAGE:path}}` placeholders in page content to `/api/v1/files/{id}/download` URLs

### Step 6: Verify Results

```bash
# Count migrated pages
npm run sql "SELECT COUNT(*) FROM wiki.pages WHERE section_id IN (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'mobius-documentation'))"

# Pages per section
npm run sql "SELECT s.title, COUNT(p.id) as pages FROM wiki.sections s LEFT JOIN wiki.pages p ON s.id = p.section_id WHERE s.wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'mobius-documentation') GROUP BY s.title ORDER BY s.title"

# Version count per page (top 10)
npm run sql "SELECT p.title, COUNT(v.id) as versions FROM wiki.pages p JOIN wiki.page_versions v ON p.id = v.page_id GROUP BY p.id ORDER BY versions DESC LIMIT 10"
```

## Command Reference

### migrate-docs.js

```bash
node scripts/migrate-docs.js [options]

Options:
  --dry-run       Preview without making database changes
  --file <path>   Migrate a single file (for testing)
  --resume        Continue from last checkpoint
```

### import-docs-images.js

```bash
node scripts/import-docs-images.js [options]

Options:
  --dry-run       Preview without copying files or updating database
  --resolve-only  Only resolve placeholders (don't import new images)
```

### rollback-docs-migration.js

```bash
node scripts/rollback-docs-migration.js [options]

Options:
  --include-files   Also delete imported files from uploads/docs-migration/
  --include-users   Also delete user accounts created for git authors
  --dry-run         Preview what would be deleted
```

### generate-migration-users.js

```bash
node scripts/generate-migration-users.js

# Output: migration-data/users.sql
```

## Technical Details

### Image URL Format

Images in page content use the wiki file API:

```
/api/v1/files/{fileId}/download
```

Example: `/api/v1/files/610/download`

### Image Placeholder System

During migration, the AsciiDoc converter creates placeholders:

```html
<img src="{{IMAGE:moduleName/pageName/image.png}}">
```

The `import-docs-images.js` script resolves these to actual file IDs:

```html
<img src="/api/v1/files/610/download">
```

### Author Normalization

Git authors are normalized to canonical identities. The mapping is in `lib/author-normalizer.js`:

| Git Variants | Normalized |
|--------------|------------|
| "Ted Peterson", "Ted P" | Ted Peterson |
| "bmagic007", "blake" | Blake |
| "Christopher", "Christopher Gould" | Christopher Gould |

System accounts (MOBIUS Admin, docs server, etc.) are attributed to the admin user.

### Antora Directive Handling

The converter strips Antora-specific directives that would cause errors:

- `include::*_attributes.adoc[]` - Antora attribute files
- `:moduledir:` definitions
- `ifndef::env-site[]` conditionals
- `:attachmentsdir:`, `:examplesdir:`, `:partialsdir:` paths

### Files Storage

Imported images are stored in:

```
backend/uploads/docs-migration/
```

File naming convention: `{originalName}_{hash}.{ext}`

Example: `github_desktop_webpage_a3da1f0ea327b7ed.png`

## Rollback Procedure

### Option 1: Database Snapshot Restore

Restores the entire database to pre-migration state:

```bash
npm run db:snapshot restore pre-docs-migration
```

### Option 2: Selective Rollback

Deletes only migration-created content:

```bash
# Delete pages and versions only
node scripts/rollback-docs-migration.js

# Delete pages, versions, AND uploaded files
node scripts/rollback-docs-migration.js --include-files

# Delete everything including user accounts
node scripts/rollback-docs-migration.js --include-files --include-users
```

## Troubleshooting

### Images Not Displaying

1. **Check file exists**: Query `wiki.files` table for the file ID
2. **Check access rules**: Files need `public` access rule for anonymous viewing
3. **Check Content-Disposition**: Should be `inline` for images (not `attachment`)
4. **Check Angular proxy**: Dev server needs proxy config to forward `/api` to backend

### AsciiDoc Conversion Errors

Some files may have issues:
- Binary/corrupted content (null bytes)
- Missing include files
- Invalid AsciiDoc syntax

Check the migration output for warnings and errors.

### Placeholder Resolution Failures

If `{{IMAGE:...}}` placeholders remain in content:
- The image file wasn't found in the source
- The filename doesn't match any imported file
- Run `import-docs-images.js --resolve-only` to retry resolution

## Related Documentation

- [File Management API](../api/06-file-management.md)
- [Page Versioning](../api/05-page-versioning.md)
- [Development Setup](./development-setup.md)
