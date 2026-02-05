-- =============================================================================
-- MOBIUS Wiki - Help Wiki Seed Data (Enhanced)
-- =============================================================================
-- Creates a comprehensive "Help" wiki showcasing all MOBIUS Wiki features
-- with beautifully styled content that serves as both documentation and examples.
--
-- Structure:
-- - 1 wiki (Help)
-- - 7 sections (Getting Started, Creating Content, Organization, Collaboration,
--               Administration, Troubleshooting, Reference)
-- - 23 pages with comprehensive HTML documentation using CSS components
-- =============================================================================

-- =============================================================================
-- 1. DELETE EXISTING HELP WIKI (if exists)
-- =============================================================================

DELETE FROM wiki.page_versions WHERE page_id IN (
  SELECT p.id FROM wiki.pages p
  JOIN wiki.sections s ON p.section_id = s.id
  WHERE s.wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help')
);

DELETE FROM wiki.pages WHERE section_id IN (
  SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help')
);

DELETE FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help');

DELETE FROM wiki.access_rules WHERE ruleable_type = 'wiki' AND ruleable_id = (SELECT id FROM wiki.wikis WHERE slug = 'help');

DELETE FROM wiki.wikis WHERE slug = 'help';

-- =============================================================================
-- 2. CREATE HELP WIKI
-- =============================================================================

INSERT INTO wiki.wikis (title, slug, description, sort_order, created_by, updated_by, created_at, updated_at)
VALUES (
  'Help',
  'help',
  'Your complete guide to MOBIUS Wiki - learn how to create, organize, and collaborate on documentation.',
  100,
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
  (SELECT id FROM wiki.wikis WHERE slug = 'help'),
  'public',
  1,
  NOW()
);

-- =============================================================================
-- 4. CREATE SECTIONS (7 sections)
-- =============================================================================

INSERT INTO wiki.sections (wiki_id, title, slug, description, sort_order, created_by, updated_by, created_at, updated_at)
VALUES
  ((SELECT id FROM wiki.wikis WHERE slug = 'help'), 'Getting Started', 'getting-started', 'New user orientation and basics', 1, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'help'), 'Creating Content', 'creating-content', 'How to create, edit, and format pages', 2, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'help'), 'Organization', 'organization', 'Understanding wiki structure and navigation', 3, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'help'), 'Collaboration', 'collaboration', 'Working with others on content', 4, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'help'), 'Administration', 'administration', 'Admin guides and system settings', 5, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'help'), 'Troubleshooting', 'troubleshooting', 'Common issues and how to resolve them', 6, 1, 1, NOW(), NOW()),
  ((SELECT id FROM wiki.wikis WHERE slug = 'help'), 'Reference', 'reference', 'Quick reference guides and shortcuts', 7, 1, 1, NOW(), NOW());

-- =============================================================================
-- 5. CREATE PAGES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION: Getting Started (4 pages)
-- -----------------------------------------------------------------------------

-- Page 1: Welcome to MOBIUS Wiki (SHOWCASE PAGE)
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'getting-started'),
  'Welcome to MOBIUS Wiki',
  'welcome',
  '<h1>Welcome to MOBIUS Wiki</h1>

<div class="callout">
<p><strong>Your collaborative documentation platform</strong> &mdash; MOBIUS Wiki helps the MOBIUS Library Consortium create, organize, and share knowledge securely and efficiently.</p>
</div>

<div class="stats-grid">
<div class="stat-card center">
<div class="stat-number"><svg class="lucide lucide-hero" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg></div>
<h4>Create</h4>
<p>Build beautiful documentation with our rich text editor featuring formatting, tables, images, and more.</p>
</div>
<div class="stat-card center">
<div class="stat-number"><svg class="lucide lucide-hero" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
<h4>Control</h4>
<p>Flexible permissions let you share publicly or restrict access to specific users, roles, or libraries.</p>
</div>
<div class="stat-card center">
<div class="stat-number"><svg class="lucide lucide-hero" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
<h4>Collaborate</h4>
<p>Work together with edit sessions, version history, and the ability to revert changes anytime.</p>
</div>
</div>

<h2>What Can You Do?</h2>

<div class="status-card info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg> Browse &amp; Read</strong>
<p>Explore wikis, sections, and pages. Use search to find exactly what you need.</p>
</div>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg> Create &amp; Edit</strong>
<p>Write new pages, update existing content, and add images and files to your documentation.</p>
</div>

<div class="status-card warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><circle cx="18" cy="18" r="3"/><path d="M10.3 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v3.3"/></svg> Organize</strong>
<p>Structure content with wikis and sections. Tag pages for easy discovery across the platform.</p>
</div>

<div class="status-card neutral">
<strong><svg class="lucide" viewBox="0 0 24 24"><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/></svg> Administer</strong>
<p>Manage users, set permissions, and configure wiki settings (admin access required).</p>
</div>

<h2>Quick Links</h2>

<table>
<thead>
<tr><th>I want to...</th><th>Go to...</th></tr>
</thead>
<tbody>
<tr><td>Get started quickly</td><td><a href="/wiki/help/getting-started/quick-start">Quick Start Guide</a></td></tr>
<tr><td>Learn the editor</td><td><a href="/wiki/help/creating-content/editor">Using the Editor</a></td></tr>
<tr><td>See formatting options</td><td><a href="/wiki/help/creating-content/formatting">Formatting &amp; Styles</a></td></tr>
<tr><td>Understand permissions</td><td><a href="/wiki/help/administration/permissions">Permissions &amp; Access Control</a></td></tr>
<tr><td>Find keyboard shortcuts</td><td><a href="/wiki/help/reference/keyboard-shortcuts">Keyboard Shortcuts</a></td></tr>
</tbody>
</table>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> New to MOBIUS Wiki?</strong>
Start with the <a href="/wiki/help/getting-started/quick-start">Quick Start Guide</a> to learn the essentials in just a few minutes.
</div>',
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

-- Page 2: Quick Start Guide
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'getting-started'),
  'Quick Start Guide',
  'quick-start',
  '<h1>Quick Start Guide</h1>

<div class="callout">
<p>Get up and running with MOBIUS Wiki in minutes. This guide covers the essential tasks every user needs to know.</p>
</div>

<h2>Navigate the Interface</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Header Bar</strong>
<p>Contains the MOBIUS logo (click to go home), search box, and your account menu in the top-right corner.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Left Sidebar</strong>
<p>Shows the wiki navigation tree. Click wikis to expand them, then sections, then pages.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Content Area</strong>
<p>The main area where you read and edit page content. Breadcrumbs at the top show your location.</p>
</div>

<h2>Browse Content</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Expand a Wiki</strong>
<p>Click the arrow next to any wiki name in the sidebar to see its sections.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Expand a Section</strong>
<p>Click a section to see all pages within it.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Open a Page</strong>
<p>Click any page title to view its content in the main area.</p>
</div>

<h2>Edit a Page</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Click Edit</strong>
<p>Find the <strong>Edit</strong> button at the top of any page you have permission to modify.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Make Changes</strong>
<p>Use the toolbar to format text, add images, create tables, and more.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Save Your Work</strong>
<p>Click <strong>Save</strong> when finished. Your changes are preserved in version history.</p>
</div>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Remember to Save</strong>
Changes are NOT automatically saved. Click the Save button to save your work. If you try to leave with unsaved changes, you''ll see a warning.
</div>

<h2>Create a New Page</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Navigate to a Section</strong>
<p>Go to the section where you want to add your new page.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Click New Page</strong>
<p>Look for the <strong>+ New Page</strong> button at the top of the section.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Add Content</strong>
<p>Enter a title, write your content, then click <strong>Save</strong> to create the page.</p>
</div>

<h2>Search for Content</h2>

<p>Use the search box in the header to find pages across all wikis you have access to:</p>

<ul>
<li>Type your search terms and press <kbd>Enter</kbd></li>
<li>Results show page titles and snippets of matching content</li>
<li>Click any result to open that page</li>
</ul>

<h2>What''s Next?</h2>

<table>
<thead>
<tr><th>Topic</th><th>Description</th></tr>
</thead>
<tbody>
<tr><td><a href="/wiki/help/creating-content/editor">Using the Editor</a></td><td>Master all formatting and editing features</td></tr>
<tr><td><a href="/wiki/help/creating-content/images">Working with Images</a></td><td>Add visual content to your pages</td></tr>
<tr><td><a href="/wiki/help/collaboration/edit-sessions">Edit Sessions</a></td><td>Learn how collaborative editing works</td></tr>
<tr><td><a href="/wiki/help/reference/keyboard-shortcuts">Keyboard Shortcuts</a></td><td>Work faster with shortcuts</td></tr>
</tbody>
</table>',
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

-- Page 3: Navigating the Interface
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'getting-started'),
  'Navigating the Interface',
  'navigation',
  '<h1>Navigating the Interface</h1>

<div class="callout">
<p>MOBIUS Wiki provides multiple ways to navigate and find content. This guide covers all navigation options available to you.</p>
</div>

<h2>The Left Sidebar</h2>

<p>The sidebar on the left shows the complete wiki structure as an expandable tree:</p>

<div class="stats-grid">
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg> Wikis</h4>
<p>Top-level containers shown in bold uppercase. Click the arrow to expand.</p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg> Sections</h4>
<p>Organizational divisions within wikis. Group related pages together.</p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> Pages</h4>
<p>Individual content items. Click to view in the main area.</p>
</div>
</div>

<h2>Breadcrumbs</h2>

<p>At the top of each page, a breadcrumb trail shows your current location:</p>

<pre><code>Home &gt; Wiki Name &gt; Section Name &gt; Page Title</code></pre>

<p>Click any part of the breadcrumb to jump directly to that level.</p>

<h2>Search</h2>

<p>The search box in the header provides full-text search across all content you have access to:</p>

<ul>
<li>Type your search terms and press <kbd>Enter</kbd></li>
<li>Results are sorted by relevance</li>
<li>Only pages you have permission to view appear in results</li>
<li>Search matches page titles, content, and tags</li>
</ul>

<h2>Keyboard Navigation</h2>

<table>
<thead>
<tr><th>Shortcut</th><th>Action</th></tr>
</thead>
<tbody>
<tr><td><kbd>Esc</kbd></td><td>Close dialogs and menus</td></tr>
</tbody>
</table>

<h2>Home Page</h2>

<p>Click the MOBIUS logo in the header to return to the home page, which shows:</p>

<ul>
<li>Quick access to all wikis</li>
<li>Recent pages you''ve viewed</li>
<li>System statistics (for admins)</li>
</ul>

<h2>Your Profile Menu</h2>

<p>Click your name in the top-right corner to access:</p>

<ul>
<li><strong>Profile</strong> &mdash; View and edit your account settings</li>
<li><strong>Admin</strong> &mdash; Access admin panel (if you have permission)</li>
<li><strong>Logout</strong> &mdash; End your session securely</li>
</ul>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Security Tip</strong>
Always log out when using a shared or public computer to protect your account.
</div>',
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

-- Page 4: Your Account & Profile
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'getting-started'),
  'Your Account & Profile',
  'account',
  '<h1>Your Account &amp; Profile</h1>

<div class="callout">
<p>Manage your MOBIUS Wiki account settings and understand your access level.</p>
</div>

<h2>Accessing Your Profile</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Click Your Name</strong>
<p>Find your name in the top-right corner of any page.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Select Profile</strong>
<p>Choose <strong>Profile</strong> from the dropdown menu.</p>
</div>

<h2>Profile Information</h2>

<p>Your profile displays:</p>

<table>
<thead>
<tr><th>Field</th><th>Description</th></tr>
</thead>
<tbody>
<tr><td><strong>Name</strong></td><td>Your display name shown throughout the wiki</td></tr>
<tr><td><strong>Email</strong></td><td>Your login email address</td></tr>
<tr><td><strong>Role</strong></td><td>Your permission level (Library Staff, MOBIUS Staff, or Site Admin)</td></tr>
<tr><td><strong>Library</strong></td><td>Your affiliated library (if applicable)</td></tr>
<tr><td><strong>Status</strong></td><td>Whether your account is active</td></tr>
</tbody>
</table>

<h2>Changing Your Password</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Go to Profile</strong>
<p>Access your profile page from the account menu.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Click Change Password</strong>
<p>Find the password section and click the change button.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Enter Passwords</strong>
<p>Type your current password, then your new password twice to confirm.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Save</strong>
<p>Click <strong>Update Password</strong> to save your new password.</p>
</div>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Password Requirements</strong>
Your password must be at least 12 characters long. We recommend using a mix of letters, numbers, and symbols for security.
</div>

<h2>Understanding Your Role</h2>

<p>Your role determines what you can do in MOBIUS Wiki:</p>

<div class="status-card info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Library Staff</strong>
<p>View and edit content for your library. Create pages in sections where you have access.</p>
</div>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg> MOBIUS Staff</strong>
<p>Access to consortium-wide content with broader editing permissions across wikis.</p>
</div>

<div class="status-card warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg> Site Admin</strong>
<p>Full access including user management, system settings, and all content across the platform.</p>
</div>

<h2>Session Security</h2>

<p>Your session remains active while you''re using the wiki. For security:</p>

<ul>
<li>Sessions automatically expire after a period of inactivity</li>
<li>Always log out when using shared computers</li>
<li>If you notice unexpected activity, change your password immediately</li>
</ul>

<h2>Need Help?</h2>

<table>
<thead>
<tr><th>Issue</th><th>Solution</th></tr>
</thead>
<tbody>
<tr><td>Forgot password</td><td>Contact your administrator to reset it</td></tr>
<tr><td>Account locked</td><td>Wait 15 minutes or contact support</td></tr>
<tr><td>Can''t access content</td><td>Check with your admin about permissions</td></tr>
<tr><td>Other issues</td><td>Email support@mobius.org</td></tr>
</tbody>
</table>',
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
-- SECTION: Creating Content (5 pages)
-- -----------------------------------------------------------------------------

-- Page 5: Creating Pages
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'creating-content'),
  'Creating Pages',
  'creating-pages',
  '<h1>Creating Pages</h1>

<div class="callout">
<p>Learn how to create new pages and understand the page lifecycle in MOBIUS Wiki.</p>
</div>

<h2>Creating a New Page</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Navigate to a Section</strong>
<p>Go to the section where you want to create your page. You must have edit permission for this section.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Click New Page</strong>
<p>Look for the <strong>+ New Page</strong> button at the top of the section view.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Enter a Title</strong>
<p>Give your page a clear, descriptive title. The URL slug is generated automatically.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Add Content</strong>
<p>Use the editor to write your content. Format text, add images, create tables as needed.</p>
</div>

<div class="flow-step">
<span class="step-number">5</span>
<strong>Save</strong>
<p>Click <strong>Save</strong> to create the page. It will appear in the sidebar navigation.</p>
</div>

<h2>Page Status</h2>

<p>Pages can be in one of two states:</p>

<div class="status-card neutral">
<strong><svg class="lucide lucide-hero" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg> Draft</strong>
<p>Only visible to users with edit permission. Use drafts for work-in-progress content that isn''t ready for others to see.</p>
</div>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Published</strong>
<p>Visible to all users who have access to the wiki/section. This is the normal state for completed content.</p>
</div>

<p>To publish a draft, edit the page and click <strong>Publish</strong> or change the status to Published.</p>

<h2>Saving Your Work</h2>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Save Manually</strong>
MOBIUS Wiki does NOT auto-save. You must click the <strong>Save</strong> button to save your changes.
</div>

<p>To protect your work:</p>
<ul>
<li>Save frequently by clicking the <strong>Save</strong> button</li>
<li>If you try to leave with unsaved changes, your browser will warn you</li>
<li>Every save creates a new version in history, so you can always recover previous content</li>
</ul>

<h2>Edit Permissions</h2>

<p>You can only create pages in sections where you have edit permission. If you don''t see the New Page button:</p>

<ul>
<li>You may only have view access to this section</li>
<li>The section may be restricted to certain roles</li>
<li>Contact your administrator if you need edit access</li>
</ul>

<h2>Best Practices</h2>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Tips for Great Pages</strong>
<ul>
<li>Use clear, descriptive titles that help users find your content</li>
<li>Start with an introduction that explains what the page covers</li>
<li>Use headings to organize content into scannable sections</li>
<li>Add relevant tags to improve discoverability</li>
<li>Include links to related pages when appropriate</li>
</ul>
</div>',
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

-- Page 6: Using the Editor
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'creating-content'),
  'Using the Editor',
  'editor',
  '<h1>Using the Editor</h1>

<div class="callout">
<p>MOBIUS Wiki uses TinyMCE, a powerful WYSIWYG (What You See Is What You Get) editor that makes creating beautifully formatted content easy and intuitive.</p>
</div>

<h2>Editor Toolbar Overview</h2>

<p>The toolbar at the top provides quick access to all formatting options:</p>

<div class="stats-grid">
<div class="stat-card">
<h4>Text Formatting</h4>
<ul>
<li>Bold, Italic, Underline</li>
<li>Strikethrough</li>
<li>Subscript, Superscript</li>
</ul>
</div>
<div class="stat-card">
<h4>Structure</h4>
<ul>
<li>Headings (H1-H6)</li>
<li>Bullet &amp; numbered lists</li>
<li>Block quotes</li>
</ul>
</div>
<div class="stat-card">
<h4>Insert</h4>
<ul>
<li>Links &amp; images</li>
<li>Tables</li>
<li>Horizontal lines</li>
</ul>
</div>
</div>

<h2>Text Formatting</h2>

<table>
<thead>
<tr><th>Format</th><th>Toolbar</th><th>Shortcut</th></tr>
</thead>
<tbody>
<tr><td><strong>Bold</strong></td><td>B button</td><td><kbd>Ctrl</kbd> + <kbd>B</kbd></td></tr>
<tr><td><em>Italic</em></td><td>I button</td><td><kbd>Ctrl</kbd> + <kbd>I</kbd></td></tr>
<tr><td><u>Underline</u></td><td>U button</td><td><kbd>Ctrl</kbd> + <kbd>U</kbd></td></tr>
<tr><td><s>Strikethrough</s></td><td>S button</td><td>&mdash;</td></tr>
</tbody>
</table>

<h2>Paragraph Styles</h2>

<p>Use the Format dropdown to apply paragraph styles:</p>

<ul>
<li><strong>Heading 1-6</strong> &mdash; For page structure (H1 for title, H2 for sections, etc.)</li>
<li><strong>Paragraph</strong> &mdash; Normal body text</li>
<li><strong>Blockquote</strong> &mdash; For quoted content</li>
<li><strong>Code</strong> &mdash; For code snippets with monospace font</li>
</ul>

<h2>Lists</h2>

<p>Create organized content with lists:</p>

<ul>
<li><strong>Bullet List</strong> &mdash; Unordered items (like this list)</li>
<li><strong>Numbered List</strong> &mdash; Sequential steps or ranked items</li>
<li>Use <kbd>Tab</kbd> to indent and create nested lists</li>
<li>Use <kbd>Shift</kbd> + <kbd>Tab</kbd> to outdent</li>
</ul>

<h2>Links</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Select Text</strong>
<p>Highlight the text you want to turn into a link.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Click Link Button</strong>
<p>Click the link icon in the toolbar or press <kbd>Ctrl</kbd> + <kbd>K</kbd>.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Enter URL</strong>
<p>Paste or type the destination URL and click OK.</p>
</div>

<h2>Tables</h2>

<p>To insert a table:</p>

<ol>
<li>Click the Table button in the toolbar</li>
<li>Select the grid size (rows x columns)</li>
<li>Click to insert</li>
<li>Click in cells to add content</li>
</ol>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Table Tip</strong>
Right-click on a table to access options for adding/removing rows and columns, merging cells, and more.
</div>

<h2>Source Code View</h2>

<p>For advanced users who want to edit HTML directly:</p>

<ol>
<li>Click the <strong>Source Code</strong> button (looks like <code>&lt;/&gt;</code>)</li>
<li>Edit the HTML directly</li>
<li>Click Source Code again to return to visual mode</li>
</ol>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Caution</strong>
Invalid HTML may be automatically cleaned up when switching back to visual mode. Always preview your changes.
</div>

<h2>Keyboard Shortcuts</h2>

<p>See the complete list at <a href="/wiki/help/reference/keyboard-shortcuts">Keyboard Shortcuts</a>.</p>',
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

-- Page 7: Formatting & Styles (SHOWCASE PAGE)
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'creating-content'),
  'Formatting & Styles',
  'formatting',
  '<h1>Formatting &amp; Styles</h1>

<div class="callout">
<p><strong>This page demonstrates every formatting option</strong> available in MOBIUS Wiki. Use it as a reference and inspiration for creating beautifully styled documentation.</p>
</div>

<h2>Headings</h2>

<p>Use headings to create a clear document structure:</p>

<ul>
<li><strong>H1</strong> &mdash; Page title (one per page)</li>
<li><strong>H2</strong> &mdash; Major sections (like this one)</li>
<li><strong>H3</strong> &mdash; Subsections within H2</li>
<li><strong>H4-H6</strong> &mdash; Further subdivisions as needed</li>
</ul>

<h2>Text Formatting</h2>

<p>Basic text styles available in the editor:</p>

<ul>
<li><strong>Bold text</strong> for emphasis and key terms</li>
<li><em>Italic text</em> for titles, terms, or subtle emphasis</li>
<li><u>Underlined text</u> (use sparingly to avoid confusion with links)</li>
<li><s>Strikethrough</s> for outdated or removed content</li>
<li><code>Inline code</code> for technical terms, file names, commands</li>
</ul>

<h2>Lists</h2>

<h3>Bullet Lists</h3>

<p>Use for items where order doesn''t matter:</p>

<ul>
<li>First item in the list</li>
<li>Second item with more detail
  <ul>
    <li>Nested item underneath</li>
    <li>Another nested item</li>
  </ul>
</li>
<li>Third item back at top level</li>
</ul>

<h3>Numbered Lists</h3>

<p>Use for sequential steps or ranked items:</p>

<ol>
<li>First do this step</li>
<li>Then proceed to this step</li>
<li>Finally, complete this step</li>
</ol>

<h2>Tables</h2>

<p>Tables organize data clearly:</p>

<table>
<thead>
<tr><th>Feature</th><th>Description</th><th>Status</th></tr>
</thead>
<tbody>
<tr><td>Rich Editor</td><td>WYSIWYG editing with TinyMCE</td><td>Available</td></tr>
<tr><td>Version History</td><td>Track all changes over time</td><td>Available</td></tr>
<tr><td>Access Control</td><td>Granular permissions system</td><td>Available</td></tr>
<tr><td>Full-Text Search</td><td>Search across all content</td><td>Available</td></tr>
</tbody>
</table>

<h2>Callout Box</h2>

<p>Callouts highlight important introductory content:</p>

<div class="callout">
<p><strong>This is a callout box.</strong> Use it for key messages, page introductions, or important announcements that should stand out from regular content.</p>
</div>

<h2>Note Boxes</h2>

<p>Note boxes provide contextual information with different severity levels:</p>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Info Note</strong>
Use info notes for helpful tips, additional context, or "good to know" information that enhances understanding.
</div>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Success Note</strong>
Use success notes for best practices, recommended approaches, or confirmation of correct actions.
</div>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Warning Note</strong>
Use warning notes for important cautions, potential issues, or things users should be careful about.
</div>

<div class="note-box danger">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Danger Note</strong>
Use danger notes for critical warnings, destructive actions, or things that could cause data loss.
</div>

<h2>Status Cards</h2>

<p>Status cards provide visual emphasis for categorized content:</p>

<div class="status-card info">
<strong><svg class="lucide" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> Information</strong>
<p>Blue status cards work well for informational content or neutral highlights.</p>
</div>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Success</strong>
<p>Green status cards indicate positive outcomes, available features, or completed items.</p>
</div>

<div class="status-card warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Warning</strong>
<p>Yellow status cards highlight cautions or items that need attention.</p>
</div>

<div class="status-card neutral">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> Neutral</strong>
<p>Gray status cards work for general content that doesn''t need color emphasis.</p>
</div>

<h2>Stats Grid</h2>

<p>Display multiple related items in a visual grid:</p>

<div class="stats-grid">
<div class="stat-card center">
<div class="stat-number">42</div>
<h4>Pages</h4>
<p>Total documentation pages</p>
</div>
<div class="stat-card center">
<div class="stat-number">8</div>
<h4>Wikis</h4>
<p>Knowledge areas</p>
</div>
<div class="stat-card center">
<div class="stat-number">156</div>
<h4>Users</h4>
<p>Active contributors</p>
</div>
</div>

<h2>Flow Steps</h2>

<p>Guide users through processes with numbered steps:</p>

<div class="flow-step">
<span class="step-number">1</span>
<strong>First Step</strong>
<p>Description of what to do in the first step of the process.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Second Step</strong>
<p>Continue with the next action in the sequence.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Final Step</strong>
<p>Complete the process with this last action.</p>
</div>

<h2>Code Blocks</h2>

<p>Display code with proper formatting:</p>

<pre><code>// Example JavaScript code
function greet(name) {
  return "Hello, " + name + "!";
}

console.log(greet("MOBIUS"));</code></pre>

<h2>Keyboard Shortcuts</h2>

<p>Display keyboard shortcuts with proper styling:</p>

<p>Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save, or <kbd>Ctrl</kbd> + <kbd>B</kbd> for bold text.</p>

<h2>Block Quotes</h2>

<blockquote>
<p>Block quotes are perfect for quoting external sources, highlighting important statements, or setting apart referenced content from your own writing.</p>
</blockquote>

<h2>Horizontal Rules</h2>

<p>Separate distinct sections with a horizontal rule:</p>

<hr>

<p>Content continues after the divider.</p>',
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

-- Page 8: Working with Images
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'creating-content'),
  'Working with Images',
  'images',
  '<h1>Working with Images</h1>

<div class="callout">
<p>Add visual content to enhance your documentation. MOBIUS Wiki supports uploading and embedding images directly in your pages.</p>
</div>

<h2>Uploading Images</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Position Your Cursor</strong>
<p>While editing, place your cursor where you want the image to appear.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Click Insert Image</strong>
<p>Find the image icon in the toolbar or use the Insert menu.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Upload Your File</strong>
<p>Click Upload and select an image from your computer.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Add Alt Text</strong>
<p>Enter a description of the image for accessibility.</p>
</div>

<div class="flow-step">
<span class="step-number">5</span>
<strong>Insert</strong>
<p>Click OK to insert the image into your page.</p>
</div>

<h2>Supported Formats</h2>

<table>
<thead>
<tr><th>Format</th><th>Extension</th><th>Best For</th></tr>
</thead>
<tbody>
<tr><td>JPEG</td><td>.jpg, .jpeg</td><td>Photographs and complex images</td></tr>
<tr><td>PNG</td><td>.png</td><td>Screenshots, diagrams, images with text</td></tr>
<tr><td>GIF</td><td>.gif</td><td>Simple animations</td></tr>
<tr><td>WebP</td><td>.webp</td><td>Modern format with excellent compression</td></tr>
<tr><td>SVG</td><td>.svg</td><td>Icons, logos, scalable graphics</td></tr>
</tbody>
</table>

<h2>File Size Limits</h2>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Maximum Size: 50 MB</strong>
For best performance, keep images under 2 MB. Large images slow down page loading for all users.
</div>

<h2>Resizing Images</h2>

<p>After inserting an image:</p>

<ol>
<li>Click on the image to select it</li>
<li>Drag the corner handles to resize</li>
<li>Hold <kbd>Shift</kbd> while dragging to maintain aspect ratio</li>
</ol>

<h2>Image Alignment</h2>

<table>
<thead>
<tr><th>Alignment</th><th>Effect</th></tr>
</thead>
<tbody>
<tr><td><strong>Left</strong></td><td>Image floats left, text wraps on right</td></tr>
<tr><td><strong>Center</strong></td><td>Image centered, text above and below</td></tr>
<tr><td><strong>Right</strong></td><td>Image floats right, text wraps on left</td></tr>
</tbody>
</table>

<p>Select the image and use the alignment buttons to change positioning.</p>

<h2>Alt Text (Accessibility)</h2>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Always Add Alt Text</strong>
Alt text describes images for users who can''t see them (screen readers) and displays if the image fails to load. Be descriptive but concise.
</div>

<p>Good alt text examples:</p>
<ul>
<li>"Screenshot of the wiki editor toolbar"</li>
<li>"Diagram showing the permission hierarchy"</li>
<li>"MOBIUS logo"</li>
</ul>

<h2>Best Practices</h2>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Image Tips</strong>
<ul>
<li>Compress large images before uploading</li>
<li>Use PNG for screenshots and diagrams</li>
<li>Use JPEG for photographs</li>
<li>Always add descriptive alt text</li>
<li>Avoid very wide images that cause scrolling</li>
<li>Consider mobile users - large images may be hard to view</li>
</ul>
</div>',
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

-- Page 9: Working with Files
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'creating-content'),
  'Working with Files',
  'files',
  '<h1>Working with Files</h1>

<div class="callout">
<p>Upload and link to documents, spreadsheets, PDFs, and other files from your wiki pages.</p>
</div>

<h2>Uploading Files</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Edit the Page</strong>
<p>Open the page where you want to add the file link.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Open File Manager</strong>
<p>Click the file/attachment icon in the toolbar.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Upload</strong>
<p>Drag and drop files or click to browse your computer.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Insert Link</strong>
<p>Click the file to insert a download link into your page.</p>
</div>

<h2>Supported File Types</h2>

<div class="stats-grid">
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg> Documents</h4>
<ul>
<li>PDF (.pdf)</li>
<li>Word (.doc, .docx)</li>
<li>Text (.txt)</li>
</ul>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg> Spreadsheets</h4>
<ul>
<li>Excel (.xls, .xlsx)</li>
<li>CSV (.csv)</li>
</ul>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/></svg> Archives</h4>
<ul>
<li>ZIP (.zip)</li>
<li>Other common formats</li>
</ul>
</div>
</div>

<h2>File Size Limits</h2>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg> Maximum Size: 50 MB</strong>
Files larger than 50 MB cannot be uploaded. Consider using external file sharing for very large files.
</div>

<h2>Managing Uploaded Files</h2>

<p>Files you upload are stored with the wiki and can be:</p>

<ul>
<li>Linked from multiple pages</li>
<li>Downloaded by users with access to the page</li>
<li>Replaced with updated versions</li>
<li>Deleted when no longer needed (admin only)</li>
</ul>

<h2>Best Practices</h2>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> File Management Tips</strong>
<ul>
<li>Use descriptive file names (not "document1.pdf")</li>
<li>Include version numbers for frequently updated files</li>
<li>Prefer PDF for documents that shouldn''t be edited</li>
<li>Consider accessibility - provide text alternatives when possible</li>
<li>Remove outdated files to avoid confusion</li>
</ul>
</div>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Security Note</strong>
Do not upload files containing sensitive information (passwords, personal data, etc.) unless the wiki section is appropriately restricted.
</div>',
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

-- -----------------------------------------------------------------------------
-- SECTION: Organization (3 pages)
-- -----------------------------------------------------------------------------

-- Page 10: Understanding the Hierarchy
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'organization'),
  'Understanding the Hierarchy',
  'structure',
  '<h1>Understanding the Hierarchy</h1>

<div class="callout">
<p>MOBIUS Wiki organizes content in a simple three-level structure that makes information easy to find and manage.</p>
</div>

<h2>The Content Structure</h2>

<div class="stats-grid">
<div class="stat-card center">
<div class="stat-number"><svg class="lucide" viewBox="0 0 24 24"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg></div>
<h4>Wikis</h4>
<p>Top-level containers for major topic areas</p>
</div>
<div class="stat-card center">
<div class="stat-number"><svg class="lucide" viewBox="0 0 24 24"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg></div>
<h4>Sections</h4>
<p>Organize related content within a wiki</p>
</div>
<div class="stat-card center">
<div class="stat-number"><svg class="lucide" viewBox="0 0 24 24"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg></div>
<h4>Pages</h4>
<p>Individual documents with your content</p>
</div>
</div>

<h2>Wikis</h2>

<p>Wikis are the highest level of organization:</p>

<ul>
<li>Each wiki represents a major topic area or purpose</li>
<li>Examples: "IT Documentation", "HR Policies", "Training Materials"</li>
<li>Wikis have their own access permissions</li>
<li>Displayed in the sidebar as expandable items</li>
</ul>

<h2>Sections</h2>

<p>Sections divide wikis into manageable parts:</p>

<ul>
<li>Every wiki contains one or more sections</li>
<li>Sections group related pages together</li>
<li>Examples: "Getting Started", "Advanced Topics", "Reference"</li>
<li>Can have their own permissions that override wiki settings</li>
</ul>

<h2>Pages</h2>

<p>Pages contain your actual content:</p>

<ul>
<li>Each page belongs to exactly one section</li>
<li>Pages have titles, content, and optional tags</li>
<li>Every page maintains its own version history</li>
<li>Can be in draft or published status</li>
</ul>

<h2>URL Structure</h2>

<p>URLs follow the hierarchy for easy navigation:</p>

<pre><code>/wiki-slug/section-slug/page-slug</code></pre>

<p>For example:</p>

<pre><code>/help/getting-started/quick-start
/it-docs/networking/vpn-setup
/policies/hr/vacation-policy</code></pre>

<h2>Best Practices</h2>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Organization Tips</strong>
<ul>
<li><strong>Keep wikis focused</strong> &mdash; Each wiki should have a clear, distinct purpose</li>
<li><strong>Use descriptive names</strong> &mdash; Help users understand what they''ll find</li>
<li><strong>Limit depth</strong> &mdash; Flat structures are easier to navigate</li>
<li><strong>Be consistent</strong> &mdash; Follow naming patterns across similar content</li>
<li><strong>Think about your audience</strong> &mdash; Structure content the way users think about it</li>
</ul>
</div>',
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

-- Page 11: Using Tags
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'organization'),
  'Using Tags',
  'tags',
  '<h1>Using Tags</h1>

<div class="callout">
<p>Tags provide a powerful way to connect related content across different wikis and sections, making it easier to discover information.</p>
</div>

<h2>What Are Tags?</h2>

<p>Tags are keywords that you attach to pages:</p>

<ul>
<li>A page can have multiple tags</li>
<li>Tags work across wiki boundaries</li>
<li>Clicking a tag shows all pages with that tag</li>
<li>Tags complement the wiki/section structure</li>
</ul>

<h2>Adding Tags</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Edit the Page</strong>
<p>Open the page you want to tag in edit mode.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Find the Tags Field</strong>
<p>Look for the Tags input below the content editor.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Add Tags</strong>
<p>Type a tag name and press Enter. Select from suggestions or create new ones.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Save</strong>
<p>Save the page to apply your tags.</p>
</div>

<h2>Finding Tagged Content</h2>

<p>Click any tag displayed on a page to see all pages with that tag. Results respect your permissions &mdash; you only see content you can access.</p>

<h2>Tag Best Practices</h2>

<div class="stats-grid">
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Do</h4>
<ul>
<li>Use consistent naming</li>
<li>Use lowercase tags</li>
<li>Be specific when helpful</li>
<li>Reuse existing tags</li>
</ul>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> Don''t</h4>
<ul>
<li>Create duplicate tags</li>
<li>Over-tag pages</li>
<li>Use vague tags</li>
<li>Mix formats</li>
</ul>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Aim For</h4>
<ul>
<li>3-5 tags per page</li>
<li>Meaningful keywords</li>
<li>Discoverable content</li>
<li>Consistent vocabulary</li>
</ul>
</div>
</div>

<h2>Common Tag Categories</h2>

<table>
<thead>
<tr><th>Category</th><th>Example Tags</th></tr>
</thead>
<tbody>
<tr><td>Content Type</td><td>how-to, reference, policy, template, guide</td></tr>
<tr><td>Audience</td><td>new-users, admins, developers, all-staff</td></tr>
<tr><td>Status</td><td>draft, needs-review, archived, updated</td></tr>
<tr><td>Topic</td><td>security, networking, reporting, integration</td></tr>
</tbody>
</table>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Tip</strong>
Check existing tags before creating new ones. Consistent tagging makes content much easier to find.
</div>',
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

-- Page 12: Search Tips
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'organization'),
  'Search Tips',
  'search',
  '<h1>Search Tips</h1>

<div class="callout">
<p>MOBIUS Wiki includes powerful full-text search. Learn how to find content quickly with these tips and techniques.</p>
</div>

<h2>Basic Search</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Focus Search</strong>
<p>Click the search box in the header.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Enter Terms</strong>
<p>Type your search words.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>View Results</strong>
<p>Press <kbd>Enter</kbd> to see matching pages ranked by relevance.</p>
</div>

<h2>What Search Covers</h2>

<table>
<thead>
<tr><th>Searches In</th><th>Description</th></tr>
</thead>
<tbody>
<tr><td>Page Titles</td><td>Matches in page names (weighted higher)</td></tr>
<tr><td>Page Content</td><td>Full text of all pages</td></tr>
<tr><td>Tags</td><td>Tag keywords attached to pages</td></tr>
</tbody>
</table>

<div class="note-box info">
<strong><svg class="lucide lucide-hero" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Permissions Apply</strong>
You only see results for pages you have permission to view. Content in restricted wikis or sections won''t appear in your results.
</div>

<h2>Search Techniques</h2>

<h3>Multiple Words</h3>

<p>Entering multiple words finds pages containing ALL of them:</p>

<pre><code>network troubleshooting</code></pre>

<p>Finds pages with both "network" AND "troubleshooting".</p>

<h2>Refining Results</h2>

<div class="stats-grid">
<div class="stat-card">
<h4>Too Many Results?</h4>
<ul>
<li>Add more specific terms</li>
<li>Use exact phrases with quotes</li>
<li>Filter by wiki in results</li>
</ul>
</div>
<div class="stat-card">
<h4>Too Few Results?</h4>
<ul>
<li>Use fewer terms</li>
<li>Try synonyms</li>
<li>Check your spelling</li>
</ul>
</div>
<div class="stat-card">
<h4>Can''t Find It?</h4>
<ul>
<li>Browse the wiki tree</li>
<li>Look for relevant tags</li>
<li>Ask a colleague</li>
</ul>
</div>
</div>

<h2>Search Shortcuts</h2>

<table>
<thead>
<tr><th>Shortcut</th><th>Action</th></tr>
</thead>
<tbody>
<tr><td><kbd>Enter</kbd></td><td>Submit search</td></tr>
<tr><td><kbd>Esc</kbd></td><td>Clear search and close results</td></tr>
</tbody>
</table>',
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
-- SECTION: Collaboration (3 pages)
-- -----------------------------------------------------------------------------

-- Page 13: Edit Sessions
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'collaboration'),
  'Edit Sessions',
  'edit-sessions',
  '<h1>Edit Sessions</h1>

<div class="callout">
<p>MOBIUS Wiki uses edit sessions to coordinate when multiple people might want to edit the same page. This prevents conflicts and lost work.</p>
</div>

<h2>How Edit Sessions Work</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>You Click Edit</strong>
<p>An edit session is created, reserving the page for you.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Others See You''re Editing</strong>
<p>A notice shows that the page is being edited and by whom.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Session Ends</strong>
<p>When you save or cancel, the session closes and others can edit.</p>
</div>

<h2>Session Indicators</h2>

<p>When someone else is editing a page, you''ll see:</p>

<div class="status-card warning">
<strong><svg class="lucide lucide-hero" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z"/></svg> Page Being Edited</strong>
<p>This page is currently being edited by <strong>Jane Smith</strong> (started 5 minutes ago)</p>
</div>

<h2>Session Timeouts</h2>

<div class="note-box warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Sessions Expire After 60 Minutes</strong>
If you''re inactive for 60 minutes, your session expires. You''ll see a warning before this happens. Activity like typing or scrolling resets the timer (heartbeat every 30 seconds).
</div>

<p>If your session expires with unsaved changes:</p>
<ul>
<li>Save immediately if possible</li>
<li>Copy your content as backup</li>
<li>Check version history for your last saved version</li>
</ul>

<h2>Taking Over a Session</h2>

<p>If someone appears to have abandoned their editing session:</p>

<ol>
<li>Click the Edit button</li>
<li>You''ll see a warning that someone else is editing</li>
<li>Choose to take over if you''re sure they''re done</li>
<li>The previous editor will be notified</li>
</ol>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Use With Care</strong>
Only take over a session if you''re confident the other person has finished. When in doubt, wait or contact them directly.
</div>

<h2>Best Practices</h2>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Edit Session Etiquette</strong>
<ul>
<li>Don''t leave pages open when not actively editing</li>
<li>Save and close when you''re finished</li>
<li>If you need to step away, save first</li>
<li>Communicate with teammates about shared documents</li>
<li>Check if someone is editing before starting</li>
</ul>
</div>',
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

-- Page 14: Version History
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'collaboration'),
  'Version History',
  'versions',
  '<h1>Version History</h1>

<div class="callout">
<p>Every time a page is saved, MOBIUS Wiki creates a new version. This complete history lets you track changes over time and recover previous content.</p>
</div>

<h2>Viewing History</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Navigate to the Page</strong>
<p>Go to the page whose history you want to view.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Click History</strong>
<p>Find the History button (often a clock icon) in the page header.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Browse Versions</strong>
<p>See all versions with dates, authors, and version numbers.</p>
</div>

<h2>Version Information</h2>

<p>Each version record includes:</p>

<table>
<thead>
<tr><th>Field</th><th>Description</th></tr>
</thead>
<tbody>
<tr><td><strong>Version Number</strong></td><td>Sequential number starting from 1</td></tr>
<tr><td><strong>Date/Time</strong></td><td>When the version was saved</td></tr>
<tr><td><strong>Author</strong></td><td>Who saved this version</td></tr>
<tr><td><strong>Size</strong></td><td>Content size (helps identify major changes)</td></tr>
</tbody>
</table>

<h2>Viewing a Previous Version</h2>

<ol>
<li>Open the version history</li>
<li>Click on any version to view it</li>
<li>The page displays as it appeared at that time</li>
<li>A banner indicates you''re viewing a historical version</li>
</ol>

<h2>When Versions Are Created</h2>

<p>A new version is created when:</p>

<ul>
<li>You click Save while editing</li>
<li>A page is restored from a previous version</li>
</ul>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Nothing is Lost</strong>
Version history keeps everything. Even if you accidentally delete content, you can always find it in a previous version.
</div>',
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

-- Page 15: Reverting Changes
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'collaboration'),
  'Reverting Changes',
  'reverting',
  '<h1>Reverting Changes</h1>

<div class="callout">
<p>Made a mistake or need to undo changes? MOBIUS Wiki makes it easy to restore any previous version of a page.</p>
</div>

<h2>When to Revert</h2>

<div class="stats-grid">
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Good Reasons</h4>
<ul>
<li>Accidental deletion</li>
<li>Changes introduced errors</li>
<li>Need to return to previous state</li>
<li>Experimental changes didn''t work</li>
</ul>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> Consider First</h4>
<ul>
<li>Can you edit instead?</li>
<li>Need only partial content?</li>
<li>Will this affect others?</li>
<li>Is there a better version?</li>
</ul>
</div>
</div>

<h2>How to Revert</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Open History</strong>
<p>Navigate to the page and click History.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Find the Version</strong>
<p>Locate the version you want to restore.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Preview It</strong>
<p>Click to view and verify it''s the right version.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Restore</strong>
<p>Click <strong>Restore</strong> or <strong>Revert to this version</strong>.</p>
</div>

<div class="flow-step">
<span class="step-number">5</span>
<strong>Confirm</strong>
<p>Confirm the action when prompted.</p>
</div>

<h2>What Happens When You Revert</h2>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Reverting Creates a New Version</strong>
When you revert, the old content becomes the new current version. Nothing is deleted &mdash; all versions remain in history. You can even "undo" a revert by reverting to a later version.
</div>

<h2>Partial Restores</h2>

<p>If you only need some content from an old version:</p>

<ol>
<li>View the old version</li>
<li>Copy the content you need</li>
<li>Edit the current version</li>
<li>Paste the old content where needed</li>
<li>Save</li>
</ol>

<h2>Undoing a Revert</h2>

<p>If you revert and change your mind:</p>

<ol>
<li>Open history again</li>
<li>Find the version from before your revert</li>
<li>Revert to that version</li>
</ol>

<p>Because reverts create new versions, you can always go back.</p>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Best Practice</strong>
Always preview a version before reverting. Make sure it contains everything you need, as reverting replaces all current content.
</div>',
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
-- SECTION: Administration (3 pages)
-- -----------------------------------------------------------------------------

-- Page 16: Managing Users
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'administration'),
  'Managing Users',
  'users',
  '<h1>Managing Users</h1>

<div class="callout">
<p>Learn how to create, edit, and manage user accounts in MOBIUS Wiki.</p>
</div>

<div class="note-box warning">
<strong><svg class="lucide lucide-hero" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Admin Access Required</strong>
This section is for Site Administrators only. If you don''t have admin access, these features won''t be available to you.
</div>

<h2>Accessing User Management</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Open Admin Panel</strong>
<p>Click your name in the top-right, then select <strong>Admin</strong>.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Go to Users</strong>
<p>Click <strong>Users</strong> in the admin navigation.</p>
</div>

<h2>User List</h2>

<p>The user list displays:</p>

<table>
<thead>
<tr><th>Column</th><th>Description</th></tr>
</thead>
<tbody>
<tr><td>Name</td><td>User''s display name</td></tr>
<tr><td>Email</td><td>Login email address</td></tr>
<tr><td>Role</td><td>Permission level</td></tr>
<tr><td>Library</td><td>Affiliated library (if applicable)</td></tr>
<tr><td>Status</td><td>Active or Inactive</td></tr>
<tr><td>Last Login</td><td>Most recent login date</td></tr>
</tbody>
</table>

<h2>Creating a User</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Click Add User</strong>
<p>Find the button at the top of the user list.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Fill In Details</strong>
<p>Enter email, name, password (min 12 chars), role, and library.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Create</strong>
<p>Click <strong>Create User</strong> to save.</p>
</div>

<h2>User Roles</h2>

<div class="status-card info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Library Staff</strong>
<p>Staff at a specific library. Access to library-specific content and assigned wikis.</p>
</div>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg> MOBIUS Staff</strong>
<p>MOBIUS consortium employees. Broader access to consortium-wide content.</p>
</div>

<div class="status-card warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg> Site Admin</strong>
<p>Full system access including user management, all content, and settings.</p>
</div>

<h2>Deactivating Users</h2>

<p>Instead of deleting users (which removes history), deactivate them:</p>

<ol>
<li>Edit the user</li>
<li>Set Status to <strong>Inactive</strong></li>
<li>Save changes</li>
</ol>

<p>Deactivated users cannot log in but their edit history is preserved.</p>

<h2>Resetting Passwords</h2>

<ol>
<li>Edit the user</li>
<li>Click <strong>Reset Password</strong></li>
<li>Enter a new temporary password</li>
<li>Share it securely with the user</li>
<li>Advise them to change it immediately</li>
</ol>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Security Tip</strong>
Never send passwords via email. Use a secure channel or have the user present when setting their temporary password.
</div>',
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

-- Page 17: Permissions & Access Control
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'administration'),
  'Permissions & Access Control',
  'permissions',
  '<h1>Permissions &amp; Access Control</h1>

<div class="callout">
<p>MOBIUS Wiki uses a flexible Access Control List (ACL) system to manage who can view and edit content at every level.</p>
</div>

<div class="note-box warning">
<strong><svg class="lucide lucide-hero" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Admin Access Required</strong>
Managing permissions requires admin access. Regular users can view their own access level but cannot change permissions.
</div>

<h2>Permission Inheritance</h2>

<p>Permissions flow down the hierarchy:</p>

<pre><code>Wiki permissions
  <svg class="lucide" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg> inherited by
Section permissions
  <svg class="lucide" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg> inherited by
Page permissions</code></pre>

<p>A permission set at the wiki level applies to all sections and pages unless overridden at a lower level.</p>

<h2>Access Rule Types</h2>

<div class="status-card info">
<strong><svg class="lucide" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg> Public</strong>
<p>Anyone can view, including non-logged-in users. Best for general documentation.</p>
</div>

<div class="status-card success">
<strong><svg class="lucide" viewBox="0 0 24 24"><circle cx="18" cy="15" r="3"/><circle cx="9" cy="7" r="4"/><path d="M10 15H6a4 4 0 0 0-4 4v2"/></svg> Role-Based</strong>
<p>Access based on user role (library_staff, mobius_staff, site_admin). Best for staff-only content.</p>
</div>

<div class="status-card warning">
<strong><svg class="lucide" viewBox="0 0 24 24"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg> Library-Based</strong>
<p>Access for users affiliated with a specific library. Best for library-specific procedures.</p>
</div>

<div class="status-card neutral">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> User-Based</strong>
<p>Access for specific individual users. Best for restricted or sensitive content.</p>
</div>

<h2>Setting Permissions</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Go to Settings</strong>
<p>Navigate to the wiki, section, or page and click Settings or Permissions.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Add Rule</strong>
<p>Click <strong>Add Rule</strong> to create a new access rule.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Configure</strong>
<p>Select the rule type and configure (select role, library, or user).</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Save</strong>
<p>Save the rule to apply it immediately.</p>
</div>

<h2>Multiple Rules</h2>

<p>Content can have multiple access rules. Access is granted if the user matches <strong>ANY</strong> rule:</p>

<table>
<thead>
<tr><th>Rule</th><th>Grants Access To</th></tr>
</thead>
<tbody>
<tr><td>Role = mobius_staff</td><td>All MOBIUS staff members</td></tr>
<tr><td>Library = Springfield Public</td><td>Springfield library users</td></tr>
</tbody>
</table>

<p>Users who are MOBIUS staff OR affiliated with Springfield can access.</p>

<h2>Troubleshooting Access</h2>

<div class="stats-grid">
<div class="stat-card">
<h4>User Can''t See Content</h4>
<ul>
<li>Check parent-level restrictions</li>
<li>Verify user''s role/library</li>
<li>Confirm account is active</li>
</ul>
</div>
<div class="stat-card">
<h4>User Sees Too Much</h4>
<ul>
<li>Check for public rules</li>
<li>Review inherited permissions</li>
<li>Check role-based rules</li>
</ul>
</div>
</div>',
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

-- Page 18: Wiki & Section Settings
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'administration'),
  'Wiki & Section Settings',
  'settings',
  '<h1>Wiki &amp; Section Settings</h1>

<div class="callout">
<p>Configure wikis and sections to organize your documentation effectively.</p>
</div>

<div class="note-box warning">
<strong><svg class="lucide lucide-hero" viewBox="0 0 24 24"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Admin Access Required</strong>
These settings require admin access.
</div>

<h2>Wiki Settings</h2>

<p>Access wiki settings by navigating to a wiki and clicking the gear icon.</p>

<h3>Basic Information</h3>

<table>
<thead>
<tr><th>Setting</th><th>Description</th></tr>
</thead>
<tbody>
<tr><td><strong>Title</strong></td><td>Display name shown in navigation</td></tr>
<tr><td><strong>Slug</strong></td><td>URL identifier (changing creates redirects)</td></tr>
<tr><td><strong>Description</strong></td><td>Brief description for wiki lists</td></tr>
<tr><td><strong>Sort Order</strong></td><td>Position in navigation (lower = higher)</td></tr>
</tbody>
</table>

<h2>Section Settings</h2>

<p>Access section settings by navigating to a section and clicking the gear icon.</p>

<table>
<thead>
<tr><th>Setting</th><th>Description</th></tr>
</thead>
<tbody>
<tr><td><strong>Title</strong></td><td>Section display name</td></tr>
<tr><td><strong>Slug</strong></td><td>URL identifier within the wiki</td></tr>
<tr><td><strong>Description</strong></td><td>Brief description</td></tr>
<tr><td><strong>Sort Order</strong></td><td>Position within the wiki</td></tr>
</tbody>
</table>

<h2>Creating a Wiki</h2>

<div class="flow-step">
<span class="step-number">1</span>
<strong>Go to Admin</strong>
<p>Open the admin panel.</p>
</div>

<div class="flow-step">
<span class="step-number">2</span>
<strong>Click Create Wiki</strong>
<p>Find the option under Wikis.</p>
</div>

<div class="flow-step">
<span class="step-number">3</span>
<strong>Configure</strong>
<p>Fill in title, slug, description, and initial permissions.</p>
</div>

<div class="flow-step">
<span class="step-number">4</span>
<strong>Create</strong>
<p>Save to create the wiki. Add sections and pages afterward.</p>
</div>

<h2>Creating a Section</h2>

<ol>
<li>Navigate to the wiki</li>
<li>Click <strong>Add Section</strong></li>
<li>Fill in section details</li>
<li>Save to create</li>
</ol>

<h2>Reordering Content</h2>

<p>To change the order of wikis, sections, or pages:</p>

<ul>
<li>Edit the sort order number (lower numbers appear first)</li>
<li>Or use drag-and-drop if available</li>
<li>Save to apply changes</li>
</ul>

<h2>Archiving vs Deleting</h2>

<div class="stats-grid">
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"/><path d="m7.5 4.27 9 5.15"/></svg> Archive</h4>
<p>Hides content but preserves it. Can be restored later. <strong>Recommended.</strong></p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> Delete</h4>
<p>Permanently removes content. Cannot be undone. Use with caution.</p>
</div>
</div>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Best Practice</strong>
Archive content instead of deleting unless you''re certain it''s no longer needed. You can always delete archived content later.
</div>',
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
-- SECTION: Troubleshooting (3 pages)
-- -----------------------------------------------------------------------------

-- Page 19: Common Issues
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'troubleshooting'),
  'Common Issues',
  'common-issues',
  '<h1>Common Issues</h1>

<div class="callout">
<p>Quick solutions to the most frequently encountered problems in MOBIUS Wiki.</p>
</div>

<h2>I Can''t Edit a Page</h2>

<div class="status-card warning">
<strong>Possible Causes:</strong>
<ul>
<li>You don''t have edit permission for this wiki/section</li>
<li>Someone else is currently editing the page</li>
<li>The page is in a restricted area</li>
</ul>
</div>

<p><strong>Solutions:</strong></p>
<ul>
<li>Check if there''s an "editing by" notice on the page</li>
<li>Wait for the other editor to finish, or contact them</li>
<li>Ask your administrator for edit access if needed</li>
</ul>

<h2>I Can''t See a Wiki or Page</h2>

<div class="status-card warning">
<strong>Possible Causes:</strong>
<ul>
<li>You don''t have view permission</li>
<li>Your role doesn''t include access to this content</li>
<li>The content is restricted to specific users/libraries</li>
</ul>
</div>

<p><strong>Solutions:</strong></p>
<ul>
<li>Verify you''re logged in with the correct account</li>
<li>Contact your administrator to request access</li>
<li>Check if the URL is correct</li>
</ul>

<h2>I Lost My Changes</h2>

<div class="status-card info">
<strong>Don''t Panic!</strong>
<p>MOBIUS Wiki keeps version history. Your last saved work may be recoverable.</p>
</div>

<p><strong>Recovery Steps:</strong></p>
<ol>
<li>Check the version history for your last saved version</li>
<li>Look for versions saved around the time you were editing</li>
<li>If found, restore that version</li>
<li>Contact your administrator if you need help</li>
</ol>

<h2>My Session Expired</h2>

<div class="status-card warning">
<strong>What Happened:</strong>
<p>Sessions expire after 60 minutes of inactivity to protect security.</p>
</div>

<p><strong>Solutions:</strong></p>
<ul>
<li>Log in again</li>
<li>Check version history for your last saved version</li>
<li>Save more frequently to avoid losing work</li>
<li>Stay active while editing (typing resets the timer)</li>
</ul>

<h2>Search Isn''t Finding My Content</h2>

<div class="status-card info">
<strong>Possible Causes:</strong>
<ul>
<li>The page might be newly created (search indexes may take time)</li>
<li>You might not have permission to view the content</li>
<li>Search terms might not match the content exactly</li>
</ul>
</div>

<p><strong>Solutions:</strong></p>
<ul>
<li>Try different search terms or synonyms</li>
<li>Use fewer words in your search</li>
<li>Browse the wiki tree manually</li>
<li>Wait a few minutes for new content to be indexed</li>
</ul>

<h2>Page Looks Wrong / Formatting Issues</h2>

<p><strong>Solutions:</strong></p>
<ul>
<li>Try a hard refresh: <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd></li>
<li>Clear your browser cache</li>
<li>Check if the issue persists in a different browser</li>
<li>Report to your administrator if it continues</li>
</ul>',
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

-- Page 20: Error Messages
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'troubleshooting'),
  'Error Messages',
  'error-messages',
  '<h1>Error Messages</h1>

<div class="callout">
<p>Understanding what error messages mean and how to resolve them.</p>
</div>

<h2>Access Denied / 403 Forbidden</h2>

<div class="status-card danger">
<strong>What It Means:</strong>
<p>You don''t have permission to view or access this content.</p>
</div>

<p><strong>How to Fix:</strong></p>
<ul>
<li>Verify you''re logged in</li>
<li>Check that you have the required role or library affiliation</li>
<li>Contact your administrator to request access</li>
</ul>

<h2>Page Not Found / 404</h2>

<div class="status-card warning">
<strong>What It Means:</strong>
<p>The page you''re looking for doesn''t exist at this URL.</p>
</div>

<p><strong>How to Fix:</strong></p>
<ul>
<li>Check the URL for typos</li>
<li>The page may have been moved or deleted</li>
<li>Use search to find the content</li>
<li>Ask a colleague if they know where the content moved</li>
</ul>

<h2>Session Expired</h2>

<div class="status-card warning">
<strong>What It Means:</strong>
<p>Your login session has timed out due to inactivity.</p>
</div>

<p><strong>How to Fix:</strong></p>
<ul>
<li>Log in again</li>
<li>If you had unsaved work, check version history</li>
</ul>

<h2>Edit Conflict / Page Locked</h2>

<div class="status-card info">
<strong>What It Means:</strong>
<p>Someone else is currently editing this page.</p>
</div>

<p><strong>How to Fix:</strong></p>
<ul>
<li>Wait for the other person to finish</li>
<li>Contact them directly if urgent</li>
<li>If the session appears abandoned, you may be able to take over</li>
</ul>

<h2>File Upload Failed</h2>

<div class="status-card warning">
<strong>Common Causes:</strong>
<ul>
<li>File exceeds size limit (max 50 MB)</li>
<li>File type not supported</li>
<li>Network interruption during upload</li>
</ul>
</div>

<p><strong>How to Fix:</strong></p>
<ul>
<li>Compress or resize large files</li>
<li>Check that the file type is allowed</li>
<li>Try uploading again with a stable connection</li>
</ul>

<h2>Server Error / 500</h2>

<div class="status-card danger">
<strong>What It Means:</strong>
<p>Something went wrong on the server side.</p>
</div>

<p><strong>How to Fix:</strong></p>
<ul>
<li>Wait a moment and try again</li>
<li>Refresh the page</li>
<li>If it persists, contact your administrator</li>
<li>Note the time and what you were doing for the report</li>
</ul>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Reporting Errors</strong>
When reporting an error, include: what you were trying to do, the exact error message, and the time it occurred. Screenshots help!
</div>',
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

-- Page 21: Getting Help
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'troubleshooting'),
  'Getting Help',
  'getting-help',
  '<h1>Getting Help</h1>

<div class="callout">
<p>Can''t find what you need? Here are all the ways to get assistance with MOBIUS Wiki.</p>
</div>

<h2>Self-Service Resources</h2>

<div class="stats-grid">
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg> This Help Wiki</h4>
<p>Browse the sections on the left for guides on every feature.</p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Search</h4>
<p>Use the search box to find specific topics quickly.</p>
</div>
<div class="stat-card">
<h4><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> FAQ</h4>
<p>Check the <a href="/wiki/faq">FAQ wiki</a> for quick answers to common questions.</p>
</div>
</div>

<h2>Contact Your Administrator</h2>

<p>Your local administrator can help with:</p>

<ul>
<li>Account issues (password resets, access problems)</li>
<li>Permission requests (access to restricted content)</li>
<li>Technical issues specific to your organization</li>
<li>Questions about policies and procedures</li>
</ul>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Who Is My Administrator?</strong>
If you don''t know who to contact, ask a colleague or check with your library''s IT department.
</div>

<h2>MOBIUS Support</h2>

<p>For issues that your local administrator can''t resolve:</p>

<div class="status-card info">
<strong><svg class="lucide" viewBox="0 0 24 24"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Email Support</strong>
<p>support@mobius.org</p>
<p>Include your name, library, and a detailed description of the issue.</p>
</div>

<h2>When Reporting Issues</h2>

<p>Help us help you by including:</p>

<table>
<thead>
<tr><th>Information</th><th>Why It Helps</th></tr>
</thead>
<tbody>
<tr><td>What you were trying to do</td><td>Helps reproduce the issue</td></tr>
<tr><td>Exact error message</td><td>Identifies the specific problem</td></tr>
<tr><td>Steps to reproduce</td><td>Allows testing the fix</td></tr>
<tr><td>Time it occurred</td><td>Helps find relevant logs</td></tr>
<tr><td>Browser and device</td><td>Some issues are browser-specific</td></tr>
<tr><td>Screenshots</td><td>Worth a thousand words!</td></tr>
</tbody>
</table>

<h2>Training Resources</h2>

<p>Looking to learn more?</p>

<ul>
<li>Start with the <a href="/wiki/help/getting-started/quick-start">Quick Start Guide</a></li>
<li>Explore the <a href="/wiki/help/creating-content/formatting">Formatting &amp; Styles</a> page for all styling options</li>
<li>Check <a href="/wiki/help/reference/keyboard-shortcuts">Keyboard Shortcuts</a> to work faster</li>
</ul>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Feedback Welcome</strong>
If you find errors in this documentation or have suggestions for improvement, let your administrator know. We''re always working to make MOBIUS Wiki better!
</div>',
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
-- SECTION: Reference (2 pages)
-- -----------------------------------------------------------------------------

-- Page 22: Keyboard Shortcuts
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'reference'),
  'Keyboard Shortcuts',
  'keyboard-shortcuts',
  '<h1>Keyboard Shortcuts</h1>

<div class="callout">
<p>Work faster with these keyboard shortcuts. Print this page for a handy reference!</p>
</div>

<h2>Global Shortcuts</h2>

<p>Available from anywhere in MOBIUS Wiki:</p>

<table>
<thead>
<tr><th>Shortcut</th><th>Action</th></tr>
</thead>
<tbody>
<tr><td><kbd>Esc</kbd></td><td>Close dialogs, menus, and overlays</td></tr>
</tbody>
</table>

<h2>Editor Shortcuts</h2>

<p>Available when editing a page (these are TinyMCE editor shortcuts):</p>

<h3>Text Formatting</h3>

<table>
<thead>
<tr><th>Shortcut</th><th>Action</th></tr>
</thead>
<tbody>
<tr><td><kbd>Ctrl</kbd> + <kbd>B</kbd></td><td>Bold</td></tr>
<tr><td><kbd>Ctrl</kbd> + <kbd>I</kbd></td><td>Italic</td></tr>
<tr><td><kbd>Ctrl</kbd> + <kbd>U</kbd></td><td>Underline</td></tr>
</tbody>
</table>

<h3>Links &amp; Media</h3>

<table>
<thead>
<tr><th>Shortcut</th><th>Action</th></tr>
</thead>
<tbody>
<tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd></td><td>Insert/edit link</td></tr>
</tbody>
</table>

<h3>Editing</h3>

<table>
<thead>
<tr><th>Shortcut</th><th>Action</th></tr>
</thead>
<tbody>
<tr><td><kbd>Ctrl</kbd> + <kbd>Z</kbd></td><td>Undo</td></tr>
<tr><td><kbd>Ctrl</kbd> + <kbd>Y</kbd></td><td>Redo</td></tr>
<tr><td><kbd>Ctrl</kbd> + <kbd>A</kbd></td><td>Select all</td></tr>
<tr><td><kbd>Ctrl</kbd> + <kbd>C</kbd></td><td>Copy</td></tr>
<tr><td><kbd>Ctrl</kbd> + <kbd>X</kbd></td><td>Cut</td></tr>
<tr><td><kbd>Ctrl</kbd> + <kbd>V</kbd></td><td>Paste</td></tr>
<tr><td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd></td><td>Paste as plain text</td></tr>
</tbody>
</table>

<h3>Lists</h3>

<table>
<thead>
<tr><th>Shortcut</th><th>Action</th></tr>
</thead>
<tbody>
<tr><td><kbd>Tab</kbd></td><td>Indent list item</td></tr>
<tr><td><kbd>Shift</kbd> + <kbd>Tab</kbd></td><td>Outdent list item</td></tr>
</tbody>
</table>

<h2>Mac Users</h2>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><rect width="18" height="12" x="3" y="4" rx="2" ry="2"/><line x1="2" x2="22" y1="20" y2="20"/></svg> Mac Keyboard</strong>
Replace <kbd>Ctrl</kbd> with <kbd>Cmd</kbd> (&#8984;) for all shortcuts on Mac.
</div>

<h2>Tips</h2>

<div class="note-box success">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg> Pro Tips</strong>
<ul>
<li>Paste as plain text (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd>) to avoid formatting issues</li>
<li>Use <kbd>Ctrl</kbd> + <kbd>Z</kbd> to undo mistakes while editing</li>
<li>Remember to click <strong>Save</strong> frequently&mdash;there is no auto-save!</li>
</ul>
</div>',
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

-- Page 23: Formatting Quick Reference
INSERT INTO wiki.pages (section_id, title, slug, content, scripts, allow_scripts, status, sort_order, published_at, published_version_number, created_by, updated_by, created_at, updated_at)
VALUES (
  (SELECT id FROM wiki.sections WHERE wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help') AND slug = 'reference'),
  'Formatting Quick Reference',
  'formatting-reference',
  '<h1>Formatting Quick Reference</h1>

<div class="callout">
<p>A condensed reference for all formatting options. For detailed examples, see <a href="/wiki/help/creating-content/formatting">Formatting &amp; Styles</a>.</p>
</div>

<h2>Text Styles</h2>

<table>
<thead>
<tr><th>Style</th><th>How to Apply</th><th>Shortcut</th></tr>
</thead>
<tbody>
<tr><td><strong>Bold</strong></td><td>B button or Format menu</td><td><kbd>Ctrl</kbd> + <kbd>B</kbd></td></tr>
<tr><td><em>Italic</em></td><td>I button or Format menu</td><td><kbd>Ctrl</kbd> + <kbd>I</kbd></td></tr>
<tr><td><u>Underline</u></td><td>U button or Format menu</td><td><kbd>Ctrl</kbd> + <kbd>U</kbd></td></tr>
<tr><td><s>Strikethrough</s></td><td>Format menu</td><td>&mdash;</td></tr>
<tr><td><code>Code</code></td><td>Format menu &rarr; Code</td><td>&mdash;</td></tr>
</tbody>
</table>

<h2>Headings</h2>

<table>
<thead>
<tr><th>Level</th><th>Use For</th></tr>
</thead>
<tbody>
<tr><td>Heading 1</td><td>Page title (one per page)</td></tr>
<tr><td>Heading 2</td><td>Major sections</td></tr>
<tr><td>Heading 3</td><td>Subsections</td></tr>
<tr><td>Heading 4-6</td><td>Further subdivisions</td></tr>
</tbody>
</table>

<h2>Lists</h2>

<table>
<thead>
<tr><th>Type</th><th>When to Use</th></tr>
</thead>
<tbody>
<tr><td>Bullet list</td><td>Unordered items</td></tr>
<tr><td>Numbered list</td><td>Sequential steps or ranked items</td></tr>
</tbody>
</table>

<p>Use <kbd>Tab</kbd> to nest, <kbd>Shift</kbd> + <kbd>Tab</kbd> to unnest.</p>

<h2>Special Elements</h2>

<table>
<thead>
<tr><th>Element</th><th>HTML Class</th><th>Use For</th></tr>
</thead>
<tbody>
<tr><td>Callout</td><td><code>callout</code></td><td>Page introductions, key messages</td></tr>
<tr><td>Info Note</td><td><code>note-box info</code></td><td>Tips and helpful information</td></tr>
<tr><td>Success Note</td><td><code>note-box success</code></td><td>Best practices, confirmations</td></tr>
<tr><td>Warning Note</td><td><code>note-box warning</code></td><td>Cautions, important notices</td></tr>
<tr><td>Danger Note</td><td><code>note-box danger</code></td><td>Critical warnings, destructive actions</td></tr>
<tr><td>Status Card</td><td><code>status-card [type]</code></td><td>Categorized content blocks</td></tr>
<tr><td>Stats Grid</td><td><code>stats-grid</code></td><td>Multi-column feature displays</td></tr>
<tr><td>Flow Step</td><td><code>flow-step</code></td><td>Numbered tutorial steps</td></tr>
</tbody>
</table>

<h2>Links &amp; Media</h2>

<table>
<thead>
<tr><th>Element</th><th>How to Insert</th></tr>
</thead>
<tbody>
<tr><td>Link</td><td>Select text, click link icon or <kbd>Ctrl</kbd> + <kbd>K</kbd></td></tr>
<tr><td>Image</td><td>Click image icon, upload or enter URL</td></tr>
<tr><td>Table</td><td>Click table icon, select grid size</td></tr>
<tr><td>Horizontal rule</td><td>Insert menu &rarr; Horizontal line</td></tr>
</tbody>
</table>

<h2>Keyboard Display</h2>

<p>To show keyboard shortcuts, use the <code>&lt;kbd&gt;</code> tag in source view:</p>

<pre><code>&lt;kbd&gt;Ctrl&lt;/kbd&gt; + &lt;kbd&gt;S&lt;/kbd&gt;</code></pre>

<p>Renders as: <kbd>Ctrl</kbd> + <kbd>S</kbd></p>

<div class="note-box info">
<strong><svg class="lucide" viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg> Source View</strong>
Advanced formatting requires editing HTML in Source Code view. Click the <code>&lt;/&gt;</code> button to access it.
</div>',
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

-- =============================================================================
-- 6. CREATE PAGE VERSIONS FOR ALL HELP PAGES
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
WHERE s.wiki_id = (SELECT id FROM wiki.wikis WHERE slug = 'help');

-- =============================================================================
-- 7. RESET SEQUENCES
-- =============================================================================

SELECT setval('wiki.wikis_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.wikis));
SELECT setval('wiki.sections_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.sections));
SELECT setval('wiki.pages_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.pages));
SELECT setval('wiki.page_versions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.page_versions));
SELECT setval('wiki.access_rules_id_seq', (SELECT COALESCE(MAX(id), 1) FROM wiki.access_rules));

-- =============================================================================
-- HELP WIKI SEED DATA COMPLETE
-- =============================================================================
-- Created:
-- - 1 Wiki (Help)
-- - 7 Sections (Getting Started, Creating Content, Organization, Collaboration,
--               Administration, Troubleshooting, Reference)
-- - 23 Pages with comprehensive, beautifully styled documentation
-- - 23 Page versions (one per page)
-- - 1 Access rule (public)
-- =============================================================================
