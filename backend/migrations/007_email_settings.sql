-- Migration: 007_email_settings.sql
-- Description: Add email configuration settings for admin panel

-- Add email configuration settings
INSERT INTO wiki.settings (key, value, description, value_type) VALUES
    ('smtp_from_email', 'scottangel@mobiusconsortium.org', 'Email address used as the sender for system emails', 'string'),
    ('smtp_from_name', 'MOBIUS Wiki', 'Display name shown as the email sender', 'string')
ON CONFLICT (key) DO NOTHING;
