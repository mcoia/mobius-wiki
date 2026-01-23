-- Migration: 006_password_reset
-- Description: Add password reset token fields to users table
-- Created: 2026-01-22

-- Add password reset fields to users table
ALTER TABLE wiki.users
  ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMP;

-- Create partial index for efficient token lookups
-- Only indexes rows where token is not null (sparse index)
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token
  ON wiki.users(password_reset_token)
  WHERE password_reset_token IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN wiki.users.password_reset_token IS 'Cryptographically secure token for password reset (base64url encoded, 32 bytes)';
COMMENT ON COLUMN wiki.users.password_reset_expires_at IS 'Token expiration timestamp (1 hour from generation)';
