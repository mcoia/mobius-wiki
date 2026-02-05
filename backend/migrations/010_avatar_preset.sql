-- Migration: 010_avatar_preset
-- Description: Add avatar_preset column for preset avatar selection
-- Date: 2026-02-05

-- Add avatar_preset column to users table
-- This stores the name of a preset avatar (e.g., "avatar-1", "avatar-3")
-- When set, this takes priority over avatar_file_id for display
ALTER TABLE wiki.users ADD COLUMN IF NOT EXISTS avatar_preset VARCHAR(50);

-- Add a comment for documentation
COMMENT ON COLUMN wiki.users.avatar_preset IS 'Name of preset avatar (e.g., avatar-1). When set, displays preset instead of uploaded photo.';
