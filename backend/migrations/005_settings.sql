-- =============================================================================
-- MOBIUS Wiki - Settings Table
-- =============================================================================
-- Provides configurable system settings for the Admin Panel
-- =============================================================================

-- =============================================================================
-- SETTINGS TABLE
-- =============================================================================
-- Key-value store for system configuration

CREATE TABLE wiki.settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    value_type VARCHAR(20) NOT NULL DEFAULT 'string'
        CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_settings_key ON wiki.settings(key);

-- =============================================================================
-- DEFAULT SETTINGS
-- =============================================================================

INSERT INTO wiki.settings (key, value, description, value_type) VALUES
    ('site_name', 'MOBIUS Wiki', 'Display name for the site', 'string'),
    ('session_timeout_minutes', '1440', 'Session timeout in minutes (default 24 hours)', 'number'),
    ('password_min_length', '12', 'Minimum password length', 'number'),
    ('password_require_uppercase', 'true', 'Require at least one uppercase letter', 'boolean'),
    ('password_require_lowercase', 'true', 'Require at least one lowercase letter', 'boolean'),
    ('password_require_numbers', 'true', 'Require at least one number', 'boolean'),
    ('max_upload_size_mb', '50', 'Maximum file upload size in MB', 'number'),
    ('allowed_file_types', '["pdf","doc","docx","xls","xlsx","ppt","pptx","txt","csv","png","jpg","jpeg","gif","svg","mp4","webm","mp3","zip"]', 'Allowed file extensions for upload', 'json');

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
