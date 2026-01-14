-- ============================================================================
-- Migration 002: Simplify ACL System & Fix Page Visibility
-- ============================================================================
-- Description: Remove 'link' and 'library' rule types + Add published version tracking
-- Author: System
-- Date: 2026-01-14
--
-- Changes:
-- Part 1: Simplify ACL
--   1. Update CHECK constraint to only allow 'public', 'role', 'user' rule types
--   2. Delete existing 'link' and 'library' access rules
--   3. Drop 'expires_at' column (only used for link rules)
-- Part 2: Fix Page Visibility
--   4. Add published_version_number to track last published version
--   5. Publish home page (critical fix)
-- ============================================================================

-- ============================================================================
-- Part 1: Simplify ACL System
-- ============================================================================

-- Step 1: Remove CHECK constraint and recreate with only 3 rule types
ALTER TABLE wiki.access_rules DROP CONSTRAINT IF EXISTS access_rules_rule_type_check;
ALTER TABLE wiki.access_rules ADD CONSTRAINT access_rules_rule_type_check
  CHECK (rule_type IN ('public', 'role', 'user'));

-- Step 2: Remove existing link and library rules (if any)
DELETE FROM wiki.access_rules WHERE rule_type IN ('link', 'library');

-- Step 3: Drop expires_at column (no longer needed without link rules)
ALTER TABLE wiki.access_rules DROP COLUMN IF EXISTS expires_at;

-- ============================================================================
-- Part 2: Fix Page Visibility Logic
-- ============================================================================

-- Step 4: Add published_version_number to track last published version
ALTER TABLE wiki.pages ADD COLUMN published_version_number INTEGER;

-- Step 5: For existing published pages, set published_version_number to current max version
UPDATE wiki.pages p
SET published_version_number = (
  SELECT MAX(version_number)
  FROM wiki.page_versions
  WHERE page_id = p.id
)
WHERE published_at IS NOT NULL;

-- Step 6: Publish the home page (critical fix - page has 35 versions but was never published)
UPDATE wiki.pages
SET status = 'published',
    published_at = NOW(),
    published_version_number = (
      SELECT MAX(version_number)
      FROM wiki.page_versions
      WHERE page_id = 3
    )
WHERE id = 3;

-- Step 7: Record migration (table is called schema_migrations, not migrations)
-- Note: This is handled by run-migrations.sh script automatically
