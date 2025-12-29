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
INSERT INTO wiki.pages (section_id, title, slug, content, created_by, updated_by, created_at, updated_at)
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
  1,
  1,
  NOW(),
  NOW()
);

-- About MOBIUS Page
INSERT INTO wiki.pages (section_id, title, slug, content, created_by, updated_by, created_at, updated_at)
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
  1,
  1,
  NOW(),
  NOW()
);

-- Terms of Service Page
INSERT INTO wiki.pages (section_id, title, slug, content, created_by, updated_by, created_at, updated_at)
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
  1,
  1,
  NOW(),
  NOW()
);

-- Help & Support Page
INSERT INTO wiki.pages (section_id, title, slug, content, created_by, updated_by, created_at, updated_at)
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
  1,
  1,
  NOW(),
  NOW()
);

-- =============================================================================
-- 5. CREATE PAGE VERSIONS (Initial versions)
-- =============================================================================

-- Create initial page_versions entries for each page
INSERT INTO wiki.page_versions (page_id, version_number, title, content, created_by, created_at)
SELECT
  p.id,
  1 as version_number,
  p.title,
  p.content,
  p.created_by,
  p.created_at
FROM wiki.pages p
JOIN wiki.sections s ON p.section_id = s.id
WHERE s.wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'site');

-- =============================================================================
-- COMPLETE
-- =============================================================================
