-- Migration: Add archived_at column to wikis table
-- Purpose: Support archiving wikis without deleting them

ALTER TABLE wiki.wikis
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for filtering archived wikis
CREATE INDEX IF NOT EXISTS idx_wikis_archived_at ON wiki.wikis(archived_at);
