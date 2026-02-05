-- =============================================================================
-- Migration 009: Add avatar_file_id to users table
-- =============================================================================
-- Adds profile photo support by linking users to files table
-- =============================================================================

-- Add avatar_file_id column to users table
ALTER TABLE wiki.users
ADD COLUMN avatar_file_id INTEGER REFERENCES wiki.files(id) ON DELETE SET NULL;

-- Create index for avatar lookups
CREATE INDEX idx_users_avatar_file_id ON wiki.users(avatar_file_id);

-- Add comment explaining the column
COMMENT ON COLUMN wiki.users.avatar_file_id IS 'References the user profile photo in the files table';
