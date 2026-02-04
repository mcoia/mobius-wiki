-- =============================================================================
-- MOBIUS Wiki - FAQ Wiki Seed Data
-- =============================================================================
-- Creates a "Frequently Asked Questions" wiki with quick answers
-- organized by topic for easy discovery.
--
-- Structure:
-- - 1 wiki (FAQ)
-- - 4 sections (General, Content, Access & Permissions, Technical)
-- - 13 FAQ pages with concise answers
-- =============================================================================

-- =============================================================================
-- 1. DELETE EXISTING FAQ WIKI (if exists)
-- =============================================================================

DELETE FROM wiki.page_versions WHERE page_id IN (
  SELECT p.id FROM wiki.pages p
  JOIN wiki.sections s ON p.section_id = s.id
  WHERE s.wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq')
);

DELETE FROM wiki.pages WHERE section_id IN (
  SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq')
);

DELETE FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq');

DELETE FROM wiki.access_rules WHERE ruleable_type = 'wiki' AND ruleable_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq');

DELETE FROM wiki.wikis WHERE slug = 'faq';

-- =============================================================================
-- 2. CREATE FAQ WIKI
-- =============================================================================

INSERT INTO wiki.wikis (title, slug, description, sort_order, created_by, updated_by, created_at, updated_at)
VALUES (
  'FAQ',
  'faq',
  'Frequently asked questions with quick answers. For detailed guides, see the Help wiki.',
  101,
  1,
  1,
  NOW(),
  NOW()
);

-- =============================================================================
-- 3. ADD PUBLIC ACCESS RULE
-- =============================================================================

INSERT INTO wiki.access_rules (ruleable_type, ruleable_id, rule_type, created_by, created_at)
VALUES (
  'wiki',
  (SELECT id FROM wiki.wikis WHERE slug = 'faq'),
  'public',
  1,
  NOW()
);

-- =============================================================================
-- 4. CREATE SECTIONS (4 sections)
-- =============================================================================

INSERT INTO wiki.sections (wiki_id, title, slug, description, sort_order, created_by, updated_by, created_at, updated_at)
VALUES
  ((SELECT id FROM wiki.wikis WHERE slug = 'faq'), 'General', 'general', 'General questions about MOBIUS Wiki', 1, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'faq'), 'Content', 'content', 'Questions about creating and editing content', 2, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'faq'), 'Access & Permissions', 'access-permissions', 'Questions about access and permissions', 3, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'faq'), 'Technical', 'technical', 'Technical questions and requirements', 4, 1, 1, NOW(), NOW());

-- =============================================================================
-- 5. CREATE PAGES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION: General (3 pages)
-- -----------------------------------------------------------------------------

-- FAQ 1: What is MOBIUS Wiki?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'general'),
  'What is MOBIUS Wiki?',
  'what-is-mobius',
  '<h1>What is MOBIUS Wiki?</h1>

<div class="callout">
<p>MOBIUS Wiki is a collaborative documentation platform designed for the MOBIUS Library Consortium.</p>
</div>

<h2>Quick Answer</h2>

<p>MOBIUS Wiki is a web-based system that allows consortium members to:</p>

<ul>
<li><strong>Create</strong> documentation using a rich text editor</li>
<li><strong>Organize</strong> content into wikis, sections, and pages</li>
<li><strong>Collaborate</strong> with version history and edit management</li>
<li><strong>Control access</strong> with flexible permissions</li>
</ul>

<h2>Key Features</h2>

<div class="stats-grid">
<div class="stat-card center">
<h4><svg class="lucide lucide-hero" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg> Rich Editor</h4>
<p>WYSIWYG editing with tables, images, and formatting</p>
</div>
<div class="stat-card center">
<h4><svg class="lucide lucide-hero" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Access Control</h4>
<p>Public, role-based, library-based, and user-specific permissions</p>
</div>
<div class="stat-card center">
<h4><svg class="lucide" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Version History</h4>
<p>Every change tracked with ability to revert</p>
</div>
</div>

<h2>Learn More</h2>

<p>See the <a href="/wiki/help/getting-started/welcome">Welcome page</a> in our Help wiki for a complete overview.</p>',
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

-- FAQ 2: Who can use MOBIUS Wiki?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'general'),
  'Who can use MOBIUS Wiki?',
  'who-can-use',
  '<h1>Who can use MOBIUS Wiki?</h1>

<div class="callout">
<p>MOBIUS Wiki is available to all MOBIUS Library Consortium members, with access varying by role.</p>
</div>

<h2>Quick Answer</h2>

<p>Three types of users can access MOBIUS Wiki:</p>

<div class="status-card info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Library Staff</strong>
<p>Staff members at MOBIUS member libraries. Access content related to their library and general consortium documentation.</p>
</div>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg> MOBIUS Staff</strong>
<p>MOBIUS consortium employees. Broader access to consortium-wide content and administration.</p>
</div>

<div class="status-card warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg> Site Administrators</strong>
<p>Full system access including user management and all content.</p>
</div>

<h2>Public Content</h2>

<p>Some wikis are marked as public and can be viewed by anyone, even without logging in.</p>

<h2>Getting Access</h2>

<p>Contact your library''s administrator or MOBIUS support to request an account.</p>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/getting-started/account">Your Account &amp; Profile</a> for details about user roles.</p>',
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

-- FAQ 3: How do I get help?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'general'),
  'How do I get help?',
  'how-to-get-help',
  '<h1>How do I get help?</h1>

<div class="callout">
<p>Multiple resources are available to help you use MOBIUS Wiki effectively.</p>
</div>

<h2>Quick Answer</h2>

<div class="stats-grid">
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg> Help Wiki</h4>
<p>Browse the <a href="/help">Help wiki</a> for comprehensive guides on every feature.</p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Search</h4>
<p>Use the search box to find answers to specific questions.</p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Support</h4>
<p>Contact support@mobius.org for issues you can''t resolve.</p>
</div>
</div>

<h2>For Account Issues</h2>

<p>Contact your local administrator for:</p>
<ul>
<li>Password resets</li>
<li>Access requests</li>
<li>Account problems</li>
</ul>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/troubleshooting/common-issues">Getting Help</a> in the Help wiki for complete support options.</p>',
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

-- -----------------------------------------------------------------------------
-- SECTION: Content (4 pages)
-- -----------------------------------------------------------------------------

-- FAQ 4: How do I create a page?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'content'),
  'How do I create a page?',
  'create-page',
  '<h1>How do I create a page?</h1>

<div class="callout">
<p>Creating a new page takes just a few clicks.</p>
</div>

<h2>Quick Answer</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Navigate to a Section</strong>
<p>Go to the section where you want to add your page.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Click + New Page</strong>
<p>Find this button at the top of the section.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Add Title &amp; Content</strong>
<p>Enter a title and write your content using the editor.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Save</strong>
<p>Click Save to create your page.</p>
</div>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Note</strong>
You need edit permission for the section to create pages. If you don''t see the New Page button, contact your administrator.
</div>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/creating-content/creating-pages">Creating Pages</a> for complete details.</p>',
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

-- FAQ 5: Can I undo changes?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'content'),
  'Can I undo changes?',
  'undo-changes',
  '<h1>Can I undo changes?</h1>

<div class="callout">
<p><strong>Yes!</strong> MOBIUS Wiki keeps a complete history of every page, so you can always recover previous content.</p>
</div>

<h2>Quick Answer</h2>

<p>You have two options:</p>

<div class="status-card info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg> Undo While Editing</strong>
<p>Press <kbd>Ctrl</kbd> + <kbd>Z</kbd> to undo recent changes in the editor before saving.</p>
</div>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Revert from History</strong>
<p>After saving, use Version History to restore any previous version of the page.</p>
</div>

<h2>How to Revert</h2>

<ol>
<li>Click <strong>History</strong> on the page</li>
<li>Find the version you want</li>
<li>Click <strong>Restore</strong></li>
</ol>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Nothing is Ever Lost</strong>
Reverting creates a new version &mdash; your current content stays in history too. You can always change back!
</div>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/collaboration/reverting">Reverting Changes</a> for complete details.</p>',
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

-- FAQ 6: What formatting is available?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'content'),
  'What formatting is available?',
  'formatting-options',
  '<h1>What formatting is available?</h1>

<div class="callout">
<p>MOBIUS Wiki supports rich formatting including text styles, lists, tables, images, and special components.</p>
</div>

<h2>Quick Answer</h2>

<div class="stats-grid">
<div class="stat-card">
<h4>Text Styles</h4>
<ul>
<li>Bold, Italic, Underline</li>
<li>Headings (H1-H6)</li>
<li>Code formatting</li>
</ul>
</div>
<div class="stat-card">
<h4>Structure</h4>
<ul>
<li>Bullet &amp; numbered lists</li>
<li>Tables</li>
<li>Block quotes</li>
</ul>
</div>
<div class="stat-card">
<h4>Media</h4>
<ul>
<li>Images</li>
<li>File attachments</li>
<li>Links</li>
</ul>
</div>
</div>

<h2>Special Components</h2>

<p>Advanced users can add callouts, note boxes, status cards, and more using HTML in source view.</p>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/creating-content/formatting">Formatting &amp; Styles</a> for examples of every formatting option.</p>',
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

-- FAQ 7: How do I add images?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'content'),
  'How do I add images?',
  'add-images',
  '<h1>How do I add images?</h1>

<div class="callout">
<p>Upload images directly into your pages using the editor toolbar.</p>
</div>

<h2>Quick Answer</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Edit the Page</strong>
<p>Open the page in edit mode.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Position Cursor</strong>
<p>Place your cursor where you want the image.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Click Image Icon</strong>
<p>Find it in the toolbar.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Upload &amp; Insert</strong>
<p>Select your file, add alt text, and click OK.</p>
</div>

<h2>Supported Formats</h2>

<p>JPEG, PNG, GIF, WebP, and SVG files up to 10 MB.</p>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Tip</strong>
Always add alt text to describe your image for accessibility.
</div>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/creating-content/images">Working with Images</a> for complete details.</p>',
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

-- -----------------------------------------------------------------------------
-- SECTION: Access & Permissions (3 pages)
-- -----------------------------------------------------------------------------

-- FAQ 8: Why can't I edit a page?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'access-permissions'),
  'Why can''t I edit a page?',
  'cant-edit',
  '<h1>Why can''t I edit a page?</h1>

<div class="callout">
<p>There are several reasons you might not be able to edit a page.</p>
</div>

<h2>Common Causes</h2>

<div class="status-card warning">
<strong><svg class="lucide lucide-hero" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> No Edit Permission</strong>
<p>You may only have view access to this wiki or section. Contact your administrator to request edit access.</p>
</div>

<div class="status-card info">
<strong><svg class="lucide lucide-hero" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg> Someone Else is Editing</strong>
<p>Another user has the page open for editing. Wait for them to finish or contact them directly.</p>
</div>

<div class="status-card neutral">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Not Logged In</strong>
<p>Make sure you''re logged in with an account that has edit permission.</p>
</div>

<h2>How to Check</h2>

<ul>
<li>Look for an "Editing by [name]" notice on the page</li>
<li>Check if there''s an Edit button visible</li>
<li>Verify you''re logged in (check top-right corner)</li>
</ul>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/collaboration/edit-sessions">Edit Sessions</a> and <a href="/wiki/help/troubleshooting/common-issues">Common Issues</a>.</p>',
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

-- FAQ 9: Why can't I see certain wikis?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'access-permissions'),
  'Why can''t I see certain wikis?',
  'cant-see-wiki',
  '<h1>Why can''t I see certain wikis?</h1>

<div class="callout">
<p>Wikis are only visible if you have permission to view them.</p>
</div>

<h2>Quick Answer</h2>

<p>Content visibility depends on access rules set by administrators:</p>

<div class="stats-grid">
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> Public</h4>
<p>Visible to everyone, including anonymous users</p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/></svg> Role-Based</h4>
<p>Visible to users with specific roles</p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg> Library-Based</h4>
<p>Visible to users from specific libraries</p>
</div>
</div>

<h2>What to Do</h2>

<ul>
<li>Verify you''re logged in with the correct account</li>
<li>Check that your profile has the right role/library</li>
<li>Contact your administrator to request access</li>
</ul>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Note</strong>
Some content may be intentionally restricted. Your administrator can explain what you should have access to.
</div>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/administration/permissions">Permissions &amp; Access Control</a>.</p>',
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

-- FAQ 10: How do permissions work?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'access-permissions'),
  'How do permissions work?',
  'how-permissions-work',
  '<h1>How do permissions work?</h1>

<div class="callout">
<p>MOBIUS Wiki uses a flexible system where permissions can be set at wiki, section, or page level.</p>
</div>

<h2>Quick Answer</h2>

<p>Permissions flow down the hierarchy:</p>

<pre><code>Wiki <svg class="lucide" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg> Section <svg class="lucide" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg> Page</code></pre>

<p>A permission set at the wiki level applies to all sections and pages unless overridden.</p>

<h2>Access Types</h2>

<table>
<thead>
<tr><th>Type</th><th>Grants Access To</th></tr>
</thead>
<tbody>
<tr><td>Public</td><td>Anyone (even without login)</td></tr>
<tr><td>Role-based</td><td>Users with a specific role</td></tr>
<tr><td>Library-based</td><td>Users from a specific library</td></tr>
<tr><td>User-based</td><td>Specific individual users</td></tr>
</tbody>
</table>

<h2>Multiple Rules</h2>

<p>Content can have multiple rules. You get access if you match <strong>any</strong> of them.</p>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> For Users</strong>
You don''t need to understand the details &mdash; if you can see it, you have access. If you can''t, contact your administrator.
</div>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/administration/permissions">Permissions &amp; Access Control</a> for complete details (admin guide).</p>',
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

-- -----------------------------------------------------------------------------
-- SECTION: Technical (3 pages)
-- -----------------------------------------------------------------------------

-- FAQ 11: What browsers are supported?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'technical'),
  'What browsers are supported?',
  'supported-browsers',
  '<h1>What browsers are supported?</h1>

<div class="callout">
<p>MOBIUS Wiki works with all modern web browsers.</p>
</div>

<h2>Supported Browsers</h2>

<table>
<thead>
<tr><th>Browser</th><th>Minimum Version</th><th>Status</th></tr>
</thead>
<tbody>
<tr><td>Google Chrome</td><td>90+</td><td><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Recommended</td></tr>
<tr><td>Mozilla Firefox</td><td>90+</td><td><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Supported</td></tr>
<tr><td>Microsoft Edge</td><td>90+</td><td><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Supported</td></tr>
<tr><td>Safari</td><td>14+</td><td><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Supported</td></tr>
</tbody>
</table>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Internet Explorer</strong>
Internet Explorer is NOT supported. Please use a modern browser.
</div>

<h2>Best Experience</h2>

<p>For the best experience:</p>

<ul>
<li>Use the latest version of your preferred browser</li>
<li>Enable JavaScript (required)</li>
<li>Enable cookies (required for login)</li>
<li>Use a screen resolution of 1280x720 or higher</li>
</ul>

<h2>Mobile Devices</h2>

<p>MOBIUS Wiki is responsive and works on tablets and phones, though editing is best on larger screens.</p>',
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

-- FAQ 12: Is my work saved automatically?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'technical'),
  'Is my work saved automatically?',
  'auto-save',
  '<h1>Is my work saved automatically?</h1>

<div class="callout">
<p><strong>Yes!</strong> MOBIUS Wiki auto-saves your work while you''re editing.</p>
</div>

<h2>How Auto-Save Works</h2>

<ul>
<li>Changes are saved automatically as you type</li>
<li>Look for the "Saving..." indicator</li>
<li>Auto-saves create versions in history</li>
</ul>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Your Work is Protected</strong>
<p>If your browser crashes or you lose connection, your recent work should be recoverable from version history.</p>
</div>

<h2>Best Practice</h2>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Still Click Save!</strong>
While auto-save protects your work, you should still click <strong>Save</strong> before leaving a page to ensure everything is captured. Use <kbd>Ctrl</kbd> + <kbd>S</kbd> for quick saving.
</div>

<h2>Session Expiration</h2>

<p>Your edit session expires after 30 minutes of inactivity. Stay active (typing, scrolling) to keep the session alive, and save frequently.</p>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/creating-content/creating-pages">Creating Pages</a> and <a href="/wiki/help/collaboration/edit-sessions">Edit Sessions</a>.</p>',
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

-- FAQ 13: What file types can I upload?
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq') AND slug = 'technical'),
  'What file types can I upload?',
  'file-types',
  '<h1>What file types can I upload?</h1>

<div class="callout">
<p>MOBIUS Wiki supports common image and document formats.</p>
</div>

<h2>Images</h2>

<table>
<thead>
<tr><th>Format</th><th>Extensions</th><th>Max Size</th></tr>
</thead>
<tbody>
<tr><td>JPEG</td><td>.jpg, .jpeg</td><td>10 MB</td></tr>
<tr><td>PNG</td><td>.png</td><td>10 MB</td></tr>
<tr><td>GIF</td><td>.gif</td><td>10 MB</td></tr>
<tr><td>WebP</td><td>.webp</td><td>10 MB</td></tr>
<tr><td>SVG</td><td>.svg</td><td>10 MB</td></tr>
</tbody>
</table>

<h2>Documents</h2>

<table>
<thead>
<tr><th>Format</th><th>Extensions</th><th>Max Size</th></tr>
</thead>
<tbody>
<tr><td>PDF</td><td>.pdf</td><td>25 MB</td></tr>
<tr><td>Word</td><td>.doc, .docx</td><td>25 MB</td></tr>
<tr><td>Excel</td><td>.xls, .xlsx</td><td>25 MB</td></tr>
<tr><td>Text</td><td>.txt</td><td>25 MB</td></tr>
<tr><td>CSV</td><td>.csv</td><td>25 MB</td></tr>
<tr><td>ZIP</td><td>.zip</td><td>25 MB</td></tr>
</tbody>
</table>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Tip</strong>
For best performance, compress images before uploading. Large files slow down page loading for everyone.
</div>

<h2>Learn More</h2>

<p>See <a href="/wiki/help/creating-content/images">Working with Images</a> and <a href="/wiki/help/creating-content/files">Working with Files</a>.</p>',
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

-- =============================================================================
-- 6. CREATE PAGE VERSIONS FOR ALL FAQ PAGES
-- =============================================================================

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
WHERE s.wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'faq');

-- =============================================================================
-- 7. RESET SEQUENCES
-- =============================================================================

SELECT setval('wiki.wikis_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.wikis));
SELECT setval('wiki.sections_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.sections));
SELECT setval('wiki.pages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.pages));
SELECT setval('wiki.page_versions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.page_versions));
SELECT setval('wiki.access_rules_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.access_rules));

-- =============================================================================
-- FAQ WIKI SEED DATA COMPLETE
-- =============================================================================
-- Created:
-- - 1 Wiki (FAQ)
-- - 4 Sections (General, Content, Access & Permissions, Technical)
-- - 13 Pages with concise FAQ answers
-- - 13 Page versions (one per page)
-- - 1 Access rule (public)
-- =============================================================================
