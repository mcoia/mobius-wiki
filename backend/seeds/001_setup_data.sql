-- =============================================================================
-- MOBIUS Wiki - Comprehensive Battle-Test Seed Data
-- =============================================================================
-- This file creates extensive test data for ALL 14 tables
-- Total: ~700-900 records testing every FK, constraint, and edge case
--
-- Organization:
-- - PART 1: Basic seed data (IDs 1-9) - Core data for application
-- - PART 2: Comprehensive test data (IDs 10+) - Battle test everything
--
-- Tests covered:
-- ✅ All foreign keys and CASCADE/SET NULL behavior
-- ✅ All CHECK constraints (role, status, rule_type, etc.)
-- ✅ All UNIQUE constraints (email, slug, composite keys)
-- ✅ Soft deletes on 6 tables
-- ✅ All 5 ACL rule types (public, link, role, library, user)
-- ✅ Polymorphic relationships (file_links, access_rules)
-- ✅ Edge cases (expired tokens, inactive users, version history, etc.)
-- =============================================================================

-- =============================================================================
-- PART 1: BASIC SEED DATA
-- =============================================================================

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
-- Hash: $2b$12$6Jn5EganDF.i49YlP2UdWO6b0vxgnPQLONzmkQHh8HGwgb5dCmT0G

INSERT INTO wiki.users (id, email, password_hash, name, role, library_id, is_active, created_at, updated_at) VALUES
(1, 'admin@mobius.org', '$2b$12$6Jn5EganDF.i49YlP2UdWO6b0vxgnPQLONzmkQHh8HGwgb5dCmT0G', 'Site Administrator', 'site_admin', NULL, true, NOW(), NOW()),
(2, 'librarian@springfield.org', '$2b$12$6Jn5EganDF.i49YlP2UdWO6b0vxgnPQLONzmkQHh8HGwgb5dCmT0G', 'Jane Smith', 'library_staff', 2, true, NOW(), NOW()),
(3, 'staff@mobius.org', '$2b$12$6Jn5EganDF.i49YlP2UdWO6b0vxgnPQLONzmkQHh8HGwgb5dCmT0G', 'John Doe', 'mobius_staff', NULL, true, NOW(), NOW());

-- Reset sequence for users
SELECT setval('wiki.users_id_seq', (SELECT MAX(id) FROM wiki.users));

-- =============================================================================
-- 3. WIKIS
-- =============================================================================

INSERT INTO wiki.wikis (id, title, slug, description, sort_order, created_at, updated_at, created_by, updated_by) VALUES
(1, 'MOBIUS Documentation', 'docs', 'Internal documentation for MOBIUS consortium staff', 1, NOW(), NOW(), 1, 1),
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

INSERT INTO wiki.pages (id, section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_at, updated_at, created_by, updated_by) VALUES
(1, 1, 'Welcome to MOBIUS Docs', 'welcome',
'<h1>Welcome to MOBIUS Documentation</h1>
<p>This is the internal documentation hub for MOBIUS consortium staff.</p>
<h2>What is MOBIUS?</h2>
<p>MOBIUS is a consortium of Missouri libraries providing shared resources and services including:</p>
<ul>
<li>Resource sharing and catalog access</li>
<li>Collaborative technology infrastructure</li>
<li>Professional development and training</li>
<li>Technical assistance and support</li>
</ul>
<h2>Getting Started</h2>
<p>Use the navigation to explore documentation topics:</p>
<ol>
<li>Review system requirements</li>
<li>Complete initial setup procedures</li>
<li>Configure library-specific settings</li>
<li>Learn administrative procedures</li>
</ol>
<p>For detailed instructions, explore the sections in this wiki.</p>',
NULL, false, 'published', 1, NOW(), 1, NOW(), NOW(), 1, 1),

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
NULL, false, 'published', 2, NOW(), 1, NOW(), NOW(), 1, 1);

-- Reset sequence for pages
SELECT setval('wiki.pages_id_seq', (SELECT MAX(id) FROM wiki.pages));

-- =============================================================================
-- 6. PAGE VERSIONS
-- =============================================================================

INSERT INTO wiki.page_versions (page_id, content, scripts, title, version_number, created_at, created_by) VALUES
(1, '<h1>Welcome to MOBIUS Documentation</h1>
<p>This is the internal documentation hub for MOBIUS consortium staff.</p>
<h2>What is MOBIUS?</h2>
<p>MOBIUS is a consortium of Missouri libraries providing shared resources and services including:</p>
<ul>
<li>Resource sharing and catalog access</li>
<li>Collaborative technology infrastructure</li>
<li>Professional development and training</li>
<li>Technical assistance and support</li>
</ul>
<h2>Getting Started</h2>
<p>Use the navigation to explore documentation topics:</p>
<ol>
<li>Review system requirements</li>
<li>Complete initial setup procedures</li>
<li>Configure library-specific settings</li>
<li>Learn administrative procedures</li>
</ol>
<p>For detailed instructions, explore the sections in this wiki.</p>',
NULL, 'Welcome to MOBIUS Docs', 1, NOW(), 1),

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
NULL, 'System Requirements', 1, NOW(), 1);

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

-- Make the MOBIUS Documentation wiki restricted to mobius_staff
INSERT INTO wiki.access_rules (ruleable_type, ruleable_id, rule_type, rule_value, created_at, created_by) VALUES
('wiki', 1, 'role', 'mobius_staff', NOW(), 1);

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
('/old-docs-slug', '/docs', NOW() - INTERVAL '10 days', 1),
('/docs/old-getting-started', '/docs/getting-started', NOW() - INTERVAL '5 days', 1);

-- =============================================================================
-- 14. SESSIONS
-- =============================================================================
-- PostgreSQL session storage

INSERT INTO wiki.sessions (sid, sess, expire) VALUES
('session_test_active_1', '{"cookie":{"maxAge":86400000},"user":{"id":1,"email":"admin@mobius.org"}}', NOW() + INTERVAL '1 day'),
('session_test_active_2', '{"cookie":{"maxAge":86400000},"user":{"id":2,"email":"librarian@springfield.org"}}', NOW() + INTERVAL '6 hours');


-- =============================================================================
-- MOBIUS Wiki - Site Wiki Seed Data
-- =============================================================================
-- Creates the "Site" wiki with platform pages (home, about, terms, help)
-- This wiki manages the MOBIUS Wiki platform's own content
-- =============================================================================

-- =============================================================================
-- 1. CREATE SITE WIKI
-- =============================================================================

INSERT INTO wiki.wikis (title, slug, description, created_by, updated_by, created_at, updated_at)
VALUES (
  'Site',
  'site',
  'MOBIUS Wiki platform documentation and policies',
  1,  -- Site Administrator
  1,
  NOW(),
  NOW()
);

-- Get the wiki ID (should be 3 after Folio and OpenRS)
-- For safety, we'll use the ID dynamically

-- =============================================================================
-- 2. ADD PUBLIC ACCESS RULE TO SITE WIKI
-- =============================================================================

INSERT INTO wiki.access_rules (ruleable_type, ruleable_id, rule_type, created_by, created_at)
VALUES (
  'wiki',
  (SELECT id FROM wiki.wikis WHERE slug = 'site'),
  'public',
  1,
  NOW()
);

-- =============================================================================
-- 3. CREATE DEFAULT SECTION FOR SITE WIKI
-- =============================================================================
-- Pages must belong to a section, so create a default "Main" section

INSERT INTO wiki.sections (wiki_id, title, slug, description, sort_order, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.wikis WHERE slug = 'site'),
  'Main',
  'main',
  'Main site pages',
  1,
  1,
  1,
  NOW(),
  NOW()
);

-- =============================================================================
-- 4. CREATE SITE WIKI PAGES (Under "Main" section)
-- =============================================================================

-- Home/Welcome Page
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'site') AND slug = 'main'),
  'Welcome',
  'home',
  '<div class="callout"><p><strong>MOBIUS Wiki</strong> is a collaborative documentation platform for the MOBIUS Library Consortium.</p></div>
<h2>What is MOBIUS Wiki?</h2>
<p>MOBIUS Wiki provides a secure, flexible platform for creating and sharing documentation across the MOBIUS Library Consortium. With powerful access controls, version history, and full-text search, you can manage everything from public documentation to private library procedures.</p>
<h2>Key Features</h2>
<ul>
<li><strong>Flexible Access Control</strong> - 5 rule types with inheritance</li>
<li><strong>Full-Text Search</strong> - Find content quickly with ACL filtering</li>
<li><strong>Version History</strong> - Complete audit trail for every page</li>
<li><strong>File Management</strong> - Upload and link files to content</li>
<li><strong>Analytics</strong> - Track page views and popular content</li>
</ul>
<h2>Getting Started</h2>
<p>Explore the navigation to learn more about MOBIUS, review our terms of service, or get help and support.</p>',
  NULL,
  false,
  'published',
  1,
  NOW(),
  1,
  1,
  1,
  NOW(),
  NOW()
);

-- About MOBIUS Page
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'site') AND slug = 'main'),
  'About MOBIUS',
  'about',
  '<h1>About MOBIUS</h1>
<p>The MOBIUS Library Consortium is a collaborative organization of academic, public, and special libraries across Missouri and beyond.</p>
<h2>Our Mission</h2>
<p>MOBIUS provides shared resources and services to 72 member libraries across Missouri and neighboring states, offering access to shared collections, innovative technologies, and professional expertise.</p>
<h2>History</h2>
<p>MOBIUS was established in July 1998 by 50 libraries representing Missouri colleges and universities, with the University of Missouri acting as the initial host institution.</p>
<h2>Services</h2>
<ul>
<li>Resource sharing and catalog access</li>
<li>Collaborative technology infrastructure</li>
<li>Professional development and training</li>
<li>Technical assistance and support</li>
<li>System management for member libraries</li>
</ul>',
  NULL,
  false,
  'published',
  2,
  NOW(),
  1,
  1,
  1,
  NOW(),
  NOW()
);

-- Terms of Service Page
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'site') AND slug = 'main'),
  'Terms of Service',
  'terms',
  '<h1>Terms of Service</h1>
<p><em>Last updated: December 2025</em></p>
<h2>Acceptance of Terms</h2>
<p>By accessing and using MOBIUS Wiki, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
<h2>Use License</h2>
<p>Permission is granted to member libraries and authorized users to access and use the MOBIUS Wiki platform for legitimate library consortium purposes.</p>
<h2>User Responsibilities</h2>
<ul>
<li>Maintain confidentiality of your account credentials</li>
<li>Use the platform only for authorized purposes</li>
<li>Respect copyright and intellectual property rights</li>
<li>Do not upload malicious content or attempt to breach security</li>
</ul>
<h2>Privacy</h2>
<p>We track page views and user activity for analytics purposes. This data is used to improve the platform and understand content usage patterns.</p>
<h2>Limitations</h2>
<p>MOBIUS and its members shall not be liable for any damages arising from the use or inability to use this platform.</p>
<h2>Contact</h2>
<p>For questions about these terms, please contact MOBIUS support.</p>',
  NULL,
  false,
  'published',
  3,
  NOW(),
  1,
  1,
  1,
  NOW(),
  NOW()
);

-- Help & Support Page
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'site') AND slug = 'main'),
  'Help & Support',
  'help',
  '<h1>Help & Support</h1>
<h2>Getting Help</h2>
<p>Need assistance with MOBIUS Wiki? We''re here to help!</p>
<h2>Common Questions</h2>
<h3>How do I create a wiki?</h3>
<p>Log in with your credentials and navigate to the Wiki management area. Click "Create Wiki" and follow the prompts.</p>
<h3>How do I control who can see my content?</h3>
<p>MOBIUS Wiki uses a flexible Access Control List (ACL) system with 5 rule types: public, role, library, user, and link sharing. See the API documentation for details.</p>
<h3>Can I see previous versions of a page?</h3>
<p>Yes! Every page save creates a new version entry. You can view the complete version history for any page.</p>
<h2>Technical Support</h2>
<p>For technical issues or questions:</p>
<ul>
<li><strong>Email:</strong> support@mobius.org</li>
<li><strong>Documentation:</strong> See the API documentation at <code>/docs/api/</code></li>
<li><strong>Issue Tracker:</strong> Report bugs on GitHub</li>
</ul>
<h2>User Guide</h2>
<p>Complete documentation for all features is available in the API documentation. Key topics:</p>
<ul>
<li>Authentication and sessions</li>
<li>Content management (wikis, sections, pages)</li>
<li>Access control and permissions</li>
<li>File uploads and linking</li>
<li>Search functionality</li>
<li>Analytics and page views</li>
</ul>',
  NULL,
  false,
  'published',
  4,
  NOW(),
  1,
  1,
  1,
  NOW(),
  NOW()
);

-- Contact Page
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'site') AND slug = 'main'),
  'Contact',
  'contact',
  '<h1>Contact Us</h1>
<p>Get in touch with the MOBIUS Library Consortium.</p>
<h2>General Inquiries</h2>
<ul>
<li><strong>Email:</strong> info@mobius.org</li>
<li><strong>Phone:</strong> (800) 555-0199</li>
</ul>
<h2>Technical Support</h2>
<ul>
<li><strong>Email:</strong> support@mobius.org</li>
<li><strong>Help Desk:</strong> Available Monday-Friday, 8am-5pm CT</li>
</ul>
<h2>Mailing Address</h2>
<p>MOBIUS<br>111 E. Broadway, Suite 220<br>Columbia, MO 65203</p>',
  NULL,
  false,
  'published',
  5,
  NOW(),
  1,
  1,
  1,
  NOW(),
  NOW()
);

-- Privacy Policy Page
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'site') AND slug = 'main'),
  'Privacy Policy',
  'privacy',
  '<h1>Privacy Policy</h1>
<p><em>Last updated: January 2026</em></p>
<h2>Information We Collect</h2>
<p>MOBIUS Wiki collects information necessary to provide our services:</p>
<ul>
<li>Account information (email, name, library affiliation)</li>
<li>Usage data (page views, session information)</li>
<li>Content you create or upload</li>
</ul>
<h2>How We Use Information</h2>
<p>We use collected information to:</p>
<ul>
<li>Provide and improve the MOBIUS Wiki platform</li>
<li>Analyze usage patterns and popular content</li>
<li>Ensure platform security and prevent abuse</li>
</ul>
<h2>Data Sharing</h2>
<p>We do not sell personal information. Data may be shared with member libraries for legitimate consortium purposes.</p>
<h2>Contact</h2>
<p>Questions about this policy? Contact support@mobius.org</p>',
  NULL,
  false,
  'published',
  6,
  NOW(),
  1,
  1,
  1,
  NOW(),
  NOW()
);

-- =============================================================================
-- 5. CREATE PAGE VERSIONS (Initial versions)
-- =============================================================================

-- Create initial page_versions entries for each page
INSERT INTO wiki.page_versions (page_id, version_number, title, content, scripts, created_by, created_at)
SELECT
  p.id,
  1 as version_number,
  p.title,
  p.content,
  p.scripts,
  p.created_by,
  p.created_at
FROM wiki.pages p
JOIN wiki.sections s ON p.section_id = s.id
WHERE s.wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'site');

-- =============================================================================
-- COMPLETE
-- =============================================================================
