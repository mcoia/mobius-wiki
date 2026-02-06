-- =============================================================================
-- Migration 011: File Audit Logs
-- =============================================================================
-- Adds:
--   1. description column to files table
--   2. file_audit_logs table for tracking file operations
-- =============================================================================

-- Add description column to files table
ALTER TABLE wiki.files ADD COLUMN IF NOT EXISTS description TEXT;

-- =============================================================================
-- FILE_AUDIT_LOGS TABLE
-- =============================================================================
-- Tracks all file operations for audit and compliance purposes

CREATE TABLE wiki.file_audit_logs (
  id SERIAL PRIMARY KEY,
  file_id INTEGER REFERENCES wiki.files(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN (
    'upload', 'download', 'delete', 'restore', 'replace',
    'link', 'unlink', 'access_rule_add', 'access_rule_remove',
    'metadata_update'
  )),
  actor_id INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_file_audit_logs_file_id ON wiki.file_audit_logs(file_id);
CREATE INDEX idx_file_audit_logs_actor_id ON wiki.file_audit_logs(actor_id);
CREATE INDEX idx_file_audit_logs_created_at ON wiki.file_audit_logs(created_at);
CREATE INDEX idx_file_audit_logs_action ON wiki.file_audit_logs(action);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
