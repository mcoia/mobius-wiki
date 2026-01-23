-- =============================================================================
-- MOBIUS Wiki - Invitation Token Support
-- =============================================================================
-- Adds columns to support email invitation flow for account creation
-- =============================================================================

-- Add invitation token columns to users table
ALTER TABLE wiki.users
  ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMP;

-- Create index for fast token lookup (partial index for non-null tokens only)
CREATE INDEX IF NOT EXISTS idx_users_invitation_token
  ON wiki.users(invitation_token)
  WHERE invitation_token IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN wiki.users.invitation_token IS 'Token for account setup invitation';
COMMENT ON COLUMN wiki.users.invitation_expires_at IS 'Expiration time for invitation token';

-- Make password_hash nullable to support invitation-based account creation
-- Users created via invitation will have NULL password_hash until they set their password
ALTER TABLE wiki.users
  ALTER COLUMN password_hash DROP NOT NULL;

-- Add invitation expiration setting
INSERT INTO wiki.settings (key, value, description, value_type)
VALUES ('invitation_expiry_days', '7', 'Number of days invitation links remain valid', 'number')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
