-- CREATE DATABASE mobius_wiki;

-- Create wiki schema
CREATE SCHEMA IF NOT EXISTS wiki;

-- Migration Tracking Table
-- This table tracks which migrations have been applied to the database
CREATE TABLE IF NOT EXISTS wiki.schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_name ON wiki.schema_migrations(migration_name);
