-- Migration: 003_edit_sessions
-- Description: Create page_edit_sessions table for concurrent editing awareness
-- Created: 2026-01-16

-- Track active editing sessions for concurrent editing awareness
CREATE TABLE wiki.page_edit_sessions (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES wiki.pages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES wiki.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Index for quickly finding active sessions for a page
CREATE INDEX idx_page_edit_sessions_active
  ON wiki.page_edit_sessions(page_id)
  WHERE ended_at IS NULL;

-- Index for cleanup queries (find stale sessions)
CREATE INDEX idx_page_edit_sessions_heartbeat
  ON wiki.page_edit_sessions(last_heartbeat)
  WHERE ended_at IS NULL;

-- Partial unique constraint: one active session per user per page
CREATE UNIQUE INDEX idx_page_edit_sessions_unique_active
  ON wiki.page_edit_sessions(page_id, user_id)
  WHERE ended_at IS NULL;

-- Record this migration
INSERT INTO wiki.schema_migrations (migration_name) VALUES ('003_edit_sessions');
