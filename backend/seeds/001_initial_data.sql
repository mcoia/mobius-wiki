-- MOBIUS Wiki - Complete Seed Data
-- This file creates sample data for ALL 14 tables for testing and development

-- =============================================================================
-- 1. LIBRARIES
-- =============================================================================

INSERT INTO wiki.libraries (id, name, slug, created_at, updated_at) VALUES
(1, 'MOBIUS Headquarters', 'mobius-hq', NOW(), NOW()),
(2, 'Springfield Public Library', 'springfield', NOW(), NOW());

-- Reset sequence for libraries
SELECT setval('wiki.libraries_id_seq', (SELECT MAX(id) FROM wiki.libraries));

-- =============================================================================
-- 2. USERS
-- =============================================================================
-- Password for all users: "admin123" (hashed with bcrypt, 12 rounds)
-- Hash: $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYPw8XPcWGa

INSERT INTO wiki.users (id, email, password_hash, name, role, library_id, is_active, created_at, updated_at) VALUES
(1, 'admin@mobius.org', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYPw8XPcWGa', 'Site Administrator', 'site_admin', NULL, true, NOW(), NOW()),
(2, 'librarian@springfield.org', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYPw8XPcWGa', 'Jane Smith', 'library_staff', 2, true, NOW(), NOW()),
(3, 'staff@mobius.org', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYPw8XPcWGa', 'John Doe', 'mobius_staff', NULL, true, NOW(), NOW());

-- Reset sequence for users
SELECT setval('wiki.users_id_seq', (SELECT MAX(id) FROM wiki.users));

-- =============================================================================
-- 3. WIKIS
-- =============================================================================

INSERT INTO wiki.wikis (id, title, slug, description, sort_order, created_at, updated_at, created_by, updated_by) VALUES
(1, 'Folio', 'folio', 'Comprehensive documentation for FOLIO library services platform', 1, NOW(), NOW(), 1, 1),
(2, 'OpenRS', 'openrs', 'OpenRS resource sharing system documentation', 2, NOW(), NOW(), 1, 1);

-- Reset sequence for wikis
SELECT setval('wiki.wikis_id_seq', (SELECT MAX(id) FROM wiki.wikis));

-- =============================================================================
-- 4. SECTIONS
-- =============================================================================

INSERT INTO wiki.sections (id, wiki_id, title, slug, description, sort_order, created_at, updated_at, created_by, updated_by) VALUES
(1, 1, 'Getting Started', 'getting-started', 'Introduction and setup guides for new users', 1, NOW(), NOW(), 1, 1),
(2, 1, 'Administration', 'administration', 'Administrative tasks and configurations', 2, NOW(), NOW(), 1, 1),
(3, 2, 'Installation', 'installation', 'OpenRS installation and setup', 1, NOW(), NOW(), 1, 1);

-- Reset sequence for sections
SELECT setval('wiki.sections_id_seq', (SELECT MAX(id) FROM wiki.sections));

-- =============================================================================
-- 5. PAGES
-- =============================================================================

INSERT INTO wiki.pages (id, section_id, title, slug, content, status, sort_order, published_at, created_at, updated_at, created_by, updated_by) VALUES
(1, 1, 'Welcome to Folio', 'welcome',
'<h1>Welcome to Folio</h1>
<p>This is your comprehensive guide to the FOLIO library services platform.</p>
<h2>What is FOLIO?</h2>
<p>FOLIO (Future of Libraries is Open) is an open-source library services platform that provides:</p>
<ul>
<li>Integrated library system (ILS) functionality</li>
<li>Resource management</li>
<li>Discovery and delivery services</li>
<li>Extensible app architecture</li>
</ul>
<h2>Getting Started</h2>
<p>Follow these steps to begin using FOLIO:</p>
<ol>
<li>Review system requirements</li>
<li>Complete initial setup</li>
<li>Configure your library settings</li>
<li>Import your catalog data</li>
</ol>
<p>For detailed instructions, explore the sections in this wiki.</p>',
'published', 1, NOW(), NOW(), NOW(), 1, 1),

(2, 1, 'System Requirements', 'system-requirements',
'<h1>System Requirements</h1>
<h2>Hardware Requirements</h2>
<ul>
<li>Minimum 8GB RAM (16GB recommended)</li>
<li>Quad-core processor</li>
<li>100GB available disk space</li>
</ul>
<h2>Software Requirements</h2>
<ul>
<li>PostgreSQL 12 or higher</li>
<li>Java 11 or higher</li>
<li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
</ul>',
'published', 2, NOW(), NOW(), NOW(), 1, 1);

-- Reset sequence for pages
SELECT setval('wiki.pages_id_seq', (SELECT MAX(id) FROM wiki.pages));

-- =============================================================================
-- 6. PAGE VERSIONS
-- =============================================================================

INSERT INTO wiki.page_versions (page_id, content, title, version_number, created_at, created_by) VALUES
(1, '<h1>Welcome to Folio</h1>
<p>This is your comprehensive guide to the FOLIO library services platform.</p>
<h2>What is FOLIO?</h2>
<p>FOLIO (Future of Libraries is Open) is an open-source library services platform that provides:</p>
<ul>
<li>Integrated library system (ILS) functionality</li>
<li>Resource management</li>
<li>Discovery and delivery services</li>
<li>Extensible app architecture</li>
</ul>
<h2>Getting Started</h2>
<p>Follow these steps to begin using FOLIO:</p>
<ol>
<li>Review system requirements</li>
<li>Complete initial setup</li>
<li>Configure your library settings</li>
<li>Import your catalog data</li>
</ol>
<p>For detailed instructions, explore the sections in this wiki.</p>',
'Welcome to Folio', 1, NOW(), 1),

(2, '<h1>System Requirements</h1>
<h2>Hardware Requirements</h2>
<ul>
<li>Minimum 8GB RAM (16GB recommended)</li>
<li>Quad-core processor</li>
<li>100GB available disk space</li>
</ul>
<h2>Software Requirements</h2>
<ul>
<li>PostgreSQL 12 or higher</li>
<li>Java 11 or higher</li>
<li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
</ul>',
'System Requirements', 1, NOW(), 1);

-- =============================================================================
-- 7. TAGS
-- =============================================================================

INSERT INTO wiki.tags (id, name, slug, created_at, created_by) VALUES
(1, 'Getting Started', 'getting-started', NOW(), 1),
(2, 'Troubleshooting', 'troubleshooting', NOW(), 1),
(3, 'Best Practices', 'best-practices', NOW(), 1),
(4, 'Administration', 'administration', NOW(), 1);

-- Reset sequence for tags
SELECT setval('wiki.tags_id_seq', (SELECT MAX(id) FROM wiki.tags));

-- =============================================================================
-- 8. PAGE TAGS (associate tags with pages)
-- =============================================================================

INSERT INTO wiki.page_tags (page_id, tag_id) VALUES
(1, 1), -- Welcome page tagged as "Getting Started"
(2, 1), -- System Requirements tagged as "Getting Started"
(2, 4); -- System Requirements tagged as "Administration"

-- =============================================================================
-- 9. FILES
-- =============================================================================

INSERT INTO wiki.files (filename, storage_path, mime_type, size_bytes, uploaded_by, uploaded_at, created_at, updated_at) VALUES
('test-document.pdf', '/uploads/test-document.pdf', 'application/pdf', 1048576, 1, NOW(), NOW(), NOW()),
('test-image.png', '/uploads/test-image.png', 'image/png', 524288, 2, NOW(), NOW(), NOW());

SELECT setval('wiki.files_id_seq', (SELECT MAX(id) FROM wiki.files));

-- =============================================================================
-- 10. FILE_LINKS
-- =============================================================================
-- Links files to other content (polymorphic relationship)

INSERT INTO wiki.file_links (file_id, linkable_type, linkable_id, created_at, created_by) VALUES
(1, 'page', 1, NOW(), 1),    -- Link PDF to "Welcome to Folio" page
(2, 'wiki', 1, NOW(), 2);    -- Link image to "Folio" wiki

-- =============================================================================
-- 11. ACCESS RULES
-- =============================================================================

-- Make the Folio wiki public
INSERT INTO wiki.access_rules (ruleable_type, ruleable_id, rule_type, rule_value, created_at, created_by) VALUES
('wiki', 1, 'public', NULL, NOW(), 1);

-- Make OpenRS wiki available only to MOBIUS staff
INSERT INTO wiki.access_rules (ruleable_type, ruleable_id, rule_type, rule_value, created_at, created_by) VALUES
('wiki', 2, 'role', 'mobius_staff', NOW(), 1);

-- =============================================================================
-- 12. PAGE_VIEWS
-- =============================================================================
-- Track page views including guest views (NULL user_id)

INSERT INTO wiki.page_views (page_id, user_id, viewed_at, session_id, referrer) VALUES
(1, 1, NOW() - INTERVAL '1 hour', 'sess_001', 'https://google.com/search?q=folio'),
(1, 2, NOW() - INTERVAL '30 minutes', 'sess_002', NULL),
(2, NULL, NOW(), 'sess_guest', NULL);  -- Guest view (user_id NULL)

-- =============================================================================
-- 13. REDIRECTS
-- =============================================================================
-- 301 redirects for slug changes

INSERT INTO wiki.redirects (old_path, new_path, created_at, created_by) VALUES
('/old-folio-slug', '/folio', NOW() - INTERVAL '10 days', 1),
('/folio/old-getting-started', '/folio/getting-started', NOW() - INTERVAL '5 days', 1);

-- =============================================================================
-- 14. SESSIONS
-- =============================================================================
-- PostgreSQL session storage

INSERT INTO wiki.sessions (sid, sess, expire) VALUES
('session_test_active_1', '{"cookie":{"maxAge":86400000},"user":{"id":1,"email":"admin@mobius.org"}}', NOW() + INTERVAL '1 day'),
('session_test_active_2', '{"cookie":{"maxAge":86400000},"user":{"id":2,"email":"librarian@springfield.org"}}', NOW() + INTERVAL '6 hours');

-- =============================================================================
-- SEED DATA SUMMARY
-- =============================================================================
-- ✅ 2 libraries (MOBIUS HQ, Springfield)
-- ✅ 3 users (site_admin, library_staff, mobius_staff) - Password: admin123
-- ✅ 2 wikis (Folio public, OpenRS staff-only)
-- ✅ 3 sections
-- ✅ 2 pages (both published with HTML content)
-- ✅ 2 page versions (version history)
-- ✅ 4 tags
-- ✅ 3 page-tag associations
-- ✅ 2 files (PDF, PNG)
-- ✅ 2 file links (polymorphic: page, wiki)
-- ✅ 2 access rules (public wiki, role-based wiki)
-- ✅ 3 page views (includes guest view)
-- ✅ 2 redirects (301 redirects for slug changes)
-- ✅ 2 sessions (active sessions)
--
-- ALL 14 TABLES NOW HAVE DATA! ✅
-- =============================================================================
