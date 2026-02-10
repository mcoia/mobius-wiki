-- =============================================================================
-- Migration 012: Add Nested Sections Support
-- =============================================================================
-- Adds parent_section_id and depth columns to support hierarchical sections.
--
-- Example structure:
--   MOBIUS Docs Wiki
--   ├── IT (section, parent_section_id=NULL, depth=0)
--   │   ├── Policies (section, parent_section_id=IT.id, depth=1)
--   │   └── Procedures (section, parent_section_id=IT.id, depth=1)
--   ├── Helpdesk (section, parent_section_id=NULL, depth=0)
--   │   ├── Policies (section, parent_section_id=Helpdesk.id, depth=1)
--   │   └── Procedures (section, parent_section_id=Helpdesk.id, depth=1)
-- =============================================================================

-- Add parent_section_id column for nested sections (nullable = root section)
ALTER TABLE wiki.sections
ADD COLUMN parent_section_id INTEGER REFERENCES wiki.sections(id) ON DELETE CASCADE;

-- Add depth column for query optimization (0 = root, 1 = first level, etc.)
ALTER TABLE wiki.sections
ADD COLUMN depth INTEGER NOT NULL DEFAULT 0;

-- Create index for efficient parent lookups
CREATE INDEX idx_sections_parent ON wiki.sections(parent_section_id)
WHERE parent_section_id IS NOT NULL;

-- Create index for depth-based queries
CREATE INDEX idx_sections_depth ON wiki.sections(wiki_id, depth);

-- Add comment for documentation
COMMENT ON COLUMN wiki.sections.parent_section_id IS 'Parent section ID for nested hierarchy. NULL means root section.';
COMMENT ON COLUMN wiki.sections.depth IS 'Nesting depth: 0=root, 1=first level child, etc.';
