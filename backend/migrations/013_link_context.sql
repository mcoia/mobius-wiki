-- Migration: Add link_context to file_links table
-- Purpose: Distinguish between inline images (TinyMCE) and attachments panel uploads
-- Date: 2026-02-10

-- Add link_context column with default 'attachment' for existing records
ALTER TABLE wiki.file_links
ADD COLUMN IF NOT EXISTS link_context VARCHAR(20) DEFAULT 'attachment'
CHECK (link_context IN ('attachment', 'inline', 'cover', 'thumbnail'));

-- Add index for efficient filtering by context
CREATE INDEX IF NOT EXISTS idx_file_links_context ON wiki.file_links(link_context);

-- Add composite index for common query pattern (linkable + context filter)
CREATE INDEX IF NOT EXISTS idx_file_links_linkable_context
ON wiki.file_links(linkable_type, linkable_id, link_context);

COMMENT ON COLUMN wiki.file_links.link_context IS 'Context of the file link: attachment (panel upload), inline (embedded in content), cover (page cover image), thumbnail (preview image)';
