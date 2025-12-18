# MOBIUS Wiki - Technical Specification

## Document Purpose

This specification defines the requirements for building the MOBIUS Wiki, a collaborative documentation platform and secure content delivery system. It is intended to guide implementation of the database schema and subsequent development.

**Target Stack:** NestJS + TypeScript + PostgreSQL (raw SQL via node-postgres)

---

## 1. Platform Overview

### 1.1 What We're Building

A wiki and secure content delivery platform serving two primary functions:

1. **Collaborative Wiki** — Public and internal documentation for MOBIUS products (Folio, OpenRS, Locate, etc.)
2. **Secure Document Delivery** — Private content sharing with member libraries and individual users (financial reports, ROI data, etc.)

### 1.2 Key Design Principles

- All authenticated users can edit any content they can view (collaborative model)
- Content visibility is controlled via Access Control Lists (ACLs), not rigid role hierarchies
- Files are first-class entities, not just page attachments
- URLs are stable and human-readable
- Private content is completely invisible to unauthorized users (including search)

---

## 2. User Model

### 2.1 Roles

Four permission levels, hierarchical (higher roles inherit lower role capabilities):

| Role | Level | Description |
|------|-------|-------------|
| `guest` | 0 | Unauthenticated visitors. No account. View public + link-shared content only. |
| `library_staff` | 1 | Member library employees. Belong to one library. Can view authorized content, create/edit pages. |
| `mobius_staff` | 2 | MOBIUS employees. Full content access. Can manage content visibility, manage library_staff accounts. |
| `site_admin` | 3 | Single account. Full system access including site settings and mobius_staff account management. |

### 2.2 Users Table

```
users
├── id (PK, auto-increment)
├── email (unique, required)
├── password_hash (required for authenticated users)
├── name (required)
├── role (enum: library_staff, mobius_staff, site_admin)
├── library_id (FK → libraries.id, nullable, required if role = library_staff)
├── is_active (boolean, default true)
├── created_at
├── updated_at
├── created_by (FK → users.id, nullable)
├── updated_by (FK → users.id, nullable)
├── deleted_at (nullable, soft delete)
└── deleted_by (FK → users.id, nullable)
```

**Notes:**
- Guests are not stored in this table—they're simply unauthenticated requests
- `library_id` is required when `role = library_staff`, null otherwise
- `is_active` allows disabling accounts without deleting them

### 2.3 Libraries Table

```
libraries
├── id (PK, auto-increment)
├── name (required)
├── slug (unique, required, URL-safe)
├── created_at
├── updated_at
├── created_by (FK → users.id, nullable)
├── updated_by (FK → users.id, nullable)
├── deleted_at (nullable, soft delete)
└── deleted_by (FK → users.id, nullable)
```

**Notes:**
- A library staff member belongs to exactly one library
- Library slug may be useful for future features (library-specific URLs, etc.)

---

## 3. Content Model

### 3.1 Hierarchy

```
Wiki (Folio, OpenRS, Locate, etc.)
└── Section (organizational grouping)
    └── Page (the actual content)
```

- A page belongs to exactly one section
- A section belongs to exactly one wiki
- Pages can have tags (flat, cross-cutting)

### 3.2 Wikis Table

```
wikis
├── id (PK, auto-increment)
├── title (required)
├── slug (unique, required, URL-safe)
├── description (text, nullable)
├── sort_order (integer, default 0, for manual ordering)
├── created_at
├── updated_at
├── created_by (FK → users.id, nullable)
├── updated_by (FK → users.id, nullable)
├── deleted_at (nullable, soft delete)
└── deleted_by (FK → users.id, nullable)
```

### 3.3 Sections Table

```
sections
├── id (PK, auto-increment)
├── wiki_id (FK → wikis.id, required)
├── title (required)
├── slug (required, unique within wiki)
├── description (text, nullable)
├── sort_order (integer, default 0)
├── created_at
├── updated_at
├── created_by (FK → users.id, nullable)
├── updated_by (FK → users.id, nullable)
├── deleted_at (nullable, soft delete)
└── deleted_by (FK → users.id, nullable)
```

**Constraint:** `UNIQUE(wiki_id, slug)` — slugs must be unique within their wiki

### 3.4 Pages Table

```
pages
├── id (PK, auto-increment)
├── section_id (FK → sections.id, required)
├── title (required)
├── slug (required, unique within section)
├── content (text, required) — stored as HTML from Quill WYSIWYG editor
├── status (enum: draft, published, default draft)
├── sort_order (integer, default 0)
├── published_at (timestamp, nullable)
├── created_at
├── updated_at
├── created_by (FK → users.id, nullable)
├── updated_by (FK → users.id, nullable)
├── deleted_at (nullable, soft delete)
└── deleted_by (FK → users.id, nullable)
```

**Constraint:** `UNIQUE(section_id, slug)` — slugs must be unique within their section

### 3.5 Content Security

**XSS Sanitization:** All HTML content MUST be sanitized server-side before saving to the database. Use a library like DOMPurify (via jsdom) or sanitize-html.

**Allowed HTML:** Configure sanitizer to permit standard formatting tags (p, h1-h6, strong, em, ul, ol, li, a, img, blockquote, pre, code, table, tr, td, th) while stripping scripts, event handlers, and dangerous attributes.

**Image Handling:**
- Images pasted into Quill are stored as inline base64 data URIs
- Maximum recommended image size: 2MB per image (enforce in Quill config)
- Images are stored directly in the content field—no separate file upload required
- Note: This approach increases database size. If storage becomes an issue, refactor to upload images to file storage and replace with URLs.

### 3.6 Page Versions Table

```
page_versions
├── id (PK, auto-increment)
├── page_id (FK → pages.id, required)
├── content (text, required) — full HTML snapshot (includes base64 images)
├── title (required) — title at time of version
├── version_number (integer, required)
├── created_at
└── created_by (FK → users.id, required)
```

**Notes:**
- Every save creates a new version
- `version_number` auto-increments per page (1, 2, 3...)
- No soft delete—versions are permanent history

**Constraint:** `UNIQUE(page_id, version_number)`

### 3.6 Tags Table

```
tags
├── id (PK, auto-increment)
├── name (unique, required)
├── slug (unique, required, URL-safe)
├── created_at
└── created_by (FK → users.id, nullable)
```

### 3.7 Page Tags Junction Table

```
page_tags
├── page_id (FK → pages.id)
├── tag_id (FK → tags.id)
└── PRIMARY KEY (page_id, tag_id)
```

---

## 4. Files Model

### 4.1 Design Philosophy

Files are first-class entities with their own identity and access rules. They can be linked to multiple content items without duplication.

### 4.2 Files Table

```
files
├── id (PK, auto-increment)
├── filename (required) — original filename
├── storage_path (required) — actual path/key in storage system
├── mime_type (required)
├── size_bytes (integer, required)
├── uploaded_by (FK → users.id, required)
├── uploaded_at (timestamp, required)
├── created_at
├── updated_at
├── deleted_at (nullable, soft delete)
└── deleted_by (FK → users.id, nullable)
```

**Notes:**
- `storage_path` is the internal path (local disk or S3 key)
- Files are never overwritten—new uploads create new records
- Soft delete allows recovery and preserves audit history

### 4.3 File Links Table

Polymorphic relationship allowing files to be linked to any content type or user.

```
file_links
├── id (PK, auto-increment)
├── file_id (FK → files.id, required)
├── linkable_type (enum: wiki, section, page, user)
├── linkable_id (integer, required)
├── created_at
└── created_by (FK → users.id, nullable)
```

**Examples:**
- File attached to a page: `linkable_type = 'page'`, `linkable_id = 42`
- Personal file for a user: `linkable_type = 'user'`, `linkable_id = 7`
- File for entire wiki: `linkable_type = 'wiki'`, `linkable_id = 1`

**Constraint:** `UNIQUE(file_id, linkable_type, linkable_id)` — prevent duplicate links

---

## 5. Access Control (ACL)

### 5.1 Design Philosophy

Content visibility is determined by Access Control Lists. Each wiki, section, page, or file can have zero or more access rules.

**Inheritance Logic:**
1. If content has its own access rules → use those rules (replaces parent)
2. If content has no access rules → inherit from parent (page → section → wiki)
3. If no rules exist up the chain → content is public

**File Visibility:**
- Files have their own access rules
- When accessed via a linked page, most restrictive wins (user must have access to both file AND page)

### 5.2 Access Rules Table

```
access_rules
├── id (PK, auto-increment)
├── ruleable_type (enum: wiki, section, page, file)
├── ruleable_id (integer, required)
├── rule_type (enum: public, link, role, library, user)
├── rule_value (varchar, nullable) — interpretation depends on rule_type
├── created_at
├── created_by (FK → users.id, nullable)
├── expires_at (timestamp, nullable) — for link shares
└── UNIQUE(ruleable_type, ruleable_id, rule_type, rule_value)
```

### 5.3 Rule Types

| rule_type | rule_value | Meaning |
|-----------|------------|---------|
| `public` | NULL | Anyone can access, no login required, discoverable |
| `link` | token string | Anyone with URL + token can access, not discoverable |
| `role` | role name | Anyone with this role or higher can access |
| `library` | library_id | Anyone belonging to this library can access |
| `user` | user_id | Only this specific user can access |

### 5.4 Access Rule Examples

**Public wiki (default):**
```
ruleable_type: wiki, ruleable_id: 1, rule_type: public, rule_value: NULL
```

**Internal wiki visible only to MOBIUS staff:**
```
ruleable_type: wiki, ruleable_id: 2, rule_type: role, rule_value: 'mobius_staff'
```

**Page shared with specific library:**
```
ruleable_type: page, ruleable_id: 42, rule_type: library, rule_value: '5'
```

**File shared with specific user:**
```
ruleable_type: file, ruleable_id: 100, rule_type: user, rule_value: '27'
```

**Page shared via link (expires in 30 days):**
```
ruleable_type: page, ruleable_id: 42, rule_type: link, rule_value: 'a8f3x9k2m1...', expires_at: '2025-01-15 00:00:00'
```

**Content shared with multiple libraries (multiple rules):**
```
ruleable_type: page, ruleable_id: 42, rule_type: library, rule_value: '5'
ruleable_type: page, ruleable_id: 42, rule_type: library, rule_value: '8'
ruleable_type: page, ruleable_id: 42, rule_type: library, rule_value: '12'
```

### 5.5 Access Check Algorithm

```
function canAccess(user, content):
    rules = getAccessRules(content)
    
    # If no rules, inherit from parent
    if rules.isEmpty():
        if content.parent exists:
            return canAccess(user, content.parent)
        else:
            return true  # No rules anywhere = public
    
    # Check each rule (OR logic — match any rule = access granted)
    for rule in rules:
        if rule.type == 'public':
            return true
        
        if rule.type == 'link':
            if request.token == rule.value AND (rule.expires_at is NULL OR rule.expires_at > now):
                return true
        
        if rule.type == 'role':
            if user.role >= rule.value:  # Role hierarchy comparison
                return true
        
        if rule.type == 'library':
            if user.library_id == rule.value:
                return true
        
        if rule.type == 'user':
            if user.id == rule.value:
                return true
    
    return false
```

### 5.6 File Access Check (Most Restrictive Wins)

When accessing a file linked to content:

```
function canAccessFileViaLink(user, file, linkedContent):
    return canAccess(user, file) AND canAccess(user, linkedContent)
```

When accessing a file directly (not via linked content):

```
function canAccessFileDirect(user, file):
    return canAccess(user, file)
```

---

## 6. Link Sharing

### 6.1 Token Generation

- Generate cryptographically secure random token (minimum 32 characters)
- Store in `access_rules.rule_value` with `rule_type = 'link'`
- Optional expiration via `expires_at`

### 6.2 Share Link URLs

**Pages:** `/{wiki-slug}/{section-slug}/{page-slug}?token={token}`

**Files:** `/files/{file-id}/{filename}?token={token}`

### 6.3 Expiration Options

Standard options to offer in UI:
- 7 days
- 30 days
- 90 days
- 1 year
- Never (expires_at = NULL)

### 6.4 Link Management

Users should be able to:
- See all active share links for content they manage
- Revoke links (delete the access_rule)
- See when links expire
- Regenerate a new link (revokes old, creates new)

---

## 7. URL Structure

### 7.1 Content URLs

| Content Type | URL Pattern | Example |
|--------------|-------------|---------|
| Wiki index | `/{wiki-slug}` | `/folio` |
| Section index | `/{wiki-slug}/{section-slug}` | `/folio/getting-started` |
| Page | `/{wiki-slug}/{section-slug}/{page-slug}` | `/folio/getting-started/first-login` |
| Tag listing | `/tags/{tag-slug}` | `/tags/troubleshooting` |
| File (direct) | `/files/{file-id}/{filename}` | `/files/42/report.pdf` |

### 7.2 Slug Rules

- Auto-generated from title on creation (lowercase, hyphens, no special chars)
- Editable before first publish
- After publish, changing slug creates redirect from old URL
- Unique within parent (same slug allowed in different sections)

### 7.3 Redirects Table

```
redirects
├── id (PK, auto-increment)
├── old_path (unique, required)
├── new_path (required)
├── created_at
└── created_by (FK → users.id, nullable)
```

**Implementation:** Middleware checks `redirects` table for 404s, issues 301 redirect if found.

---

## 8. Search

### 8.1 Requirements

- Public content searchable by everyone
- Private content searchable only by authorized users
- Link-shared content NOT indexed (not discoverable via search)
- Search must respect ACL rules in real-time

### 8.2 Searchable Fields

- Page: title, content, tags
- Wiki: title, description
- Section: title, description
- File: filename (content search is out of scope for v1)

### 8.3 Implementation Recommendation

**V1:** PostgreSQL full-text search with `tsvector` columns

```
# Add to pages table:
search_vector (tsvector, generated from title + content)

# Index:
CREATE INDEX pages_search_idx ON pages USING GIN(search_vector);
```

**Search Query Pattern:**
```sql
SELECT * FROM pages
WHERE search_vector @@ plainto_tsquery('english', :query)
  AND id IN (accessible_page_ids_for_user)  -- ACL filter
  AND deleted_at IS NULL
  AND status = 'published'
ORDER BY ts_rank(search_vector, plainto_tsquery('english', :query)) DESC;
```

**Future:** If search performance degrades at scale, migrate to Elasticsearch/Meilisearch.

---

## 9. Analytics

### 9.1 Requirements

- Track page views for all content
- Guests: aggregate only (count per page, no individual tracking)
- Logged-in users: track who viewed what, when

### 9.2 Page Views Table

```
page_views
├── id (PK, auto-increment)
├── page_id (FK → pages.id, required)
├── user_id (FK → users.id, nullable) — NULL for guests
├── viewed_at (timestamp, required)
├── session_id (varchar, nullable) — for guest session grouping
└── referrer (varchar, nullable) — where they came from
```

### 9.3 Aggregate Stats Table (Optional Optimization)

For performance, maintain pre-aggregated counts:

```
page_stats
├── page_id (PK, FK → pages.id)
├── view_count (integer, default 0)
├── unique_user_count (integer, default 0)
├── last_viewed_at (timestamp, nullable)
└── updated_at
```

Update via database trigger or background job.

### 9.4 Privacy Considerations

- Guest tracking uses session-based grouping (no persistent cookies)
- No IP address storage
- Analytics data for logged-in users is internal only

---

## 10. Audit & Soft Deletes

### 10.1 Audit Fields

All content tables include:
- `created_at` (timestamp)
- `updated_at` (timestamp)
- `created_by` (FK → users.id, nullable)
- `updated_by` (FK → users.id, nullable)

### 10.2 Soft Delete Fields

Tables with soft delete:
- `deleted_at` (timestamp, nullable)
- `deleted_by` (FK → users.id, nullable)

**Tables with soft delete:** users, libraries, wikis, sections, pages, files

**Tables without soft delete (permanent):** page_versions, access_rules, page_views, redirects, tags, page_tags, file_links

### 10.3 Query Pattern

All queries should exclude soft-deleted records by default:

```sql
SELECT * FROM pages WHERE deleted_at IS NULL;
```

Use a global scope/trait in Laravel:

```php
// In Page model
use SoftDeletes;
```

---

## 11. Database Indexes

### 11.1 Required Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_library_id ON users(library_id);
CREATE INDEX idx_users_role ON users(role);

-- Libraries
CREATE INDEX idx_libraries_slug ON libraries(slug);

-- Wikis
CREATE INDEX idx_wikis_slug ON wikis(slug);

-- Sections
CREATE INDEX idx_sections_wiki_id ON sections(wiki_id);
CREATE INDEX idx_sections_slug_wiki ON sections(wiki_id, slug);

-- Pages
CREATE INDEX idx_pages_section_id ON pages(section_id);
CREATE INDEX idx_pages_slug_section ON pages(section_id, slug);
CREATE INDEX idx_pages_status ON pages(status);
CREATE INDEX idx_pages_search ON pages USING GIN(search_vector);

-- Page Versions
CREATE INDEX idx_page_versions_page_id ON page_versions(page_id);

-- Files
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);

-- File Links
CREATE INDEX idx_file_links_file_id ON file_links(file_id);
CREATE INDEX idx_file_links_linkable ON file_links(linkable_type, linkable_id);

-- Access Rules
CREATE INDEX idx_access_rules_ruleable ON access_rules(ruleable_type, ruleable_id);
CREATE INDEX idx_access_rules_type ON access_rules(rule_type);

-- Page Views
CREATE INDEX idx_page_views_page_id ON page_views(page_id);
CREATE INDEX idx_page_views_user_id ON page_views(user_id);
CREATE INDEX idx_page_views_viewed_at ON page_views(viewed_at);

-- Redirects
CREATE INDEX idx_redirects_old_path ON redirects(old_path);

-- Tags
CREATE INDEX idx_tags_slug ON tags(slug);
```

---

## 12. Entity Relationship Summary

```
libraries
    └── users (one-to-many, via library_id)

users
    └── (creates/updates all content via audit fields)
    └── files (one-to-many, via uploaded_by)
    └── file_links (one-to-many, linkable_type='user')

wikis
    └── sections (one-to-many)
    └── access_rules (one-to-many, polymorphic)
    └── file_links (one-to-many, polymorphic)

sections
    └── pages (one-to-many)
    └── access_rules (one-to-many, polymorphic)
    └── file_links (one-to-many, polymorphic)

pages
    └── page_versions (one-to-many)
    └── page_tags (many-to-many with tags)
    └── page_views (one-to-many)
    └── access_rules (one-to-many, polymorphic)
    └── file_links (one-to-many, polymorphic)

files
    └── file_links (one-to-many)
    └── access_rules (one-to-many, polymorphic)

tags
    └── page_tags (many-to-many with pages)
```

---

## 13. Implementation Checklist

### Phase 1: Database Schema
- [ ] Create migrations for all tables
- [ ] Set up foreign key constraints
- [ ] Add indexes
- [ ] Create soft delete traits/scopes
- [ ] Seed site_admin account
- [ ] Seed sample library and library_staff for testing

### Phase 2: Models & Relationships
- [ ] Create Eloquent models for all tables
- [ ] Define relationships (belongsTo, hasMany, morphMany)
- [ ] Add audit field auto-population (created_by, updated_by)
- [ ] Implement soft delete scopes
- [ ] Create AccessRule model with helper methods

### Phase 3: Access Control
- [ ] Build canAccess() service/helper
- [ ] Implement inheritance logic
- [ ] Handle file + content most-restrictive check
- [ ] Create middleware for route-level ACL checks
- [ ] Add policy classes for each model

### Phase 4: Core Features
- [ ] Wiki CRUD
- [ ] Section CRUD
- [ ] Page CRUD with versioning
- [ ] Tag management
- [ ] File upload and linking
- [ ] Slug generation and validation

### Phase 5: Link Sharing
- [ ] Token generation
- [ ] Share link creation UI
- [ ] Expiration handling
- [ ] Link revocation
- [ ] Token validation middleware

### Phase 6: Search
- [ ] Add search_vector to pages
- [ ] Create search service with ACL filtering
- [ ] Build search UI

### Phase 7: Analytics
- [ ] Page view tracking
- [ ] Aggregate stats (optional)
- [ ] Basic reporting UI

### Phase 8: URL Management
- [ ] Slug editing
- [ ] Redirect creation on slug change
- [ ] Redirect middleware

---

## 14. Out of Scope (V1)

The following are explicitly NOT included in v1:

- Real-time collaborative editing (locking is acceptable)
- Approval workflows before publishing
- Scheduled/future publishing
- Email notifications and subscriptions
- Import from existing systems (Bluespice migration)
- File content search (search filenames only)
- Comments or discussions on pages
- API access (internal use only for v1)

---

## 15. Open Implementation Decisions

The following decisions should be made during implementation:

1. **Content Format** — HTML. Content is created via Quill WYSIWYG editor and stored as HTML.

2. **Rich Text Editor** — Quill. Supports rich text paste and inline base64 images.

3. **File Storage** — Local disk or S3? Recommend S3 for production, local for development.

4. **Session/Auth** — Server-side sessions with PostgreSQL session store. See Appendix H.

5. **Caching Strategy** — Cache rendered pages? Cache ACL lookups? Decide based on performance needs.

---

## Appendix A: Technology Stack

### Confirmed Stack

| Layer | Technology |
|-------|------------|
| Backend Framework | NestJS + TypeScript |
| Database | PostgreSQL |
| Database Access | Raw SQL via node-postgres (pg) |
| Frontend | Angular + TypeScript |
| Migrations | Raw SQL files with migration tracking |

### Why This Stack

- **NestJS**: Provides structure (modules, controllers, services, guards) without fighting against it. Same patterns as Angular—easier for the team.
- **Raw SQL**: Full control, easier debugging, no ORM abstraction to learn or fight. Team knows PostgreSQL well.
- **node-postgres (pg)**: Battle-tested, minimal abstraction, direct access to PostgreSQL features.
- **Angular**: Team expertise, TypeScript throughout, consistent patterns with NestJS backend.

### Key Libraries

```json
{
  "dependencies": {
    "@nestjs/common": "^10.x",
    "@nestjs/core": "^10.x",
    "@nestjs/platform-express": "^10.x",
    "pg": "^8.x",
    "dotenv": "^16.x"
  }
}
```

---

## Appendix B: Database Connection Pattern

### Connection Pool Setup

```typescript
// src/database/database.provider.ts
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### NestJS Database Module

```typescript
// src/database/database.module.ts
import { Module, Global } from '@nestjs/common';
import { Pool } from 'pg';
import { pool } from './database.provider';

const databasePoolFactory = {
  provide: 'DATABASE_POOL',
  useValue: pool,
};

@Global()
@Module({
  providers: [databasePoolFactory],
  exports: [databasePoolFactory],
})
export class DatabaseModule {}
```

### Using in Services

```typescript
// src/pages/pages.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PagesService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async findBySection(sectionId: number) {
    const { rows } = await this.pool.query(
      `SELECT * FROM pages 
       WHERE section_id = $1 AND deleted_at IS NULL 
       ORDER BY sort_order`,
      [sectionId]
    );
    return rows;
  }

  async findBySlug(wikiSlug: string, sectionSlug: string, pageSlug: string) {
    const { rows } = await this.pool.query(
      `SELECT p.* FROM pages p
       JOIN sections s ON p.section_id = s.id
       JOIN wikis w ON s.wiki_id = w.id
       WHERE w.slug = $1 AND s.slug = $2 AND p.slug = $3
         AND p.deleted_at IS NULL
         AND s.deleted_at IS NULL
         AND w.deleted_at IS NULL`,
      [wikiSlug, sectionSlug, pageSlug]
    );
    return rows[0] || null;
  }

  async create(data: CreatePageDto, userId: number) {
    const { rows } = await this.pool.query(
      `INSERT INTO pages (section_id, title, slug, content, status, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING *`,
      [data.sectionId, data.title, data.slug, data.content, 'draft', userId]
    );
    return rows[0];
  }
}
```

---

## Appendix C: Migration Setup

### Directory Structure

```
backend/
├── migrations/
│   ├── 000_migration_tracking.sql  # Migration tracking table
│   ├── 001_schema.sql              # Initial schema (all 14 tables)
│   └── (future migrations: 002_*.sql, 003_*.sql, etc.)
├── seeds/
│   └── 001_initial_data.sql
└── scripts/
    ├── create-db.sh           # Creates database
    ├── run-migrations.sh      # Runs migrations incrementally
    ├── migration-status.sh    # Shows applied/pending migrations
    ├── rollback-migration.sh  # Rolls back last migration
    └── test-connection.js     # Tests connection
```

### Migration Strategy

**Initial Schema:**
- `000_migration_tracking.sql` - Creates `schema_migrations` tracking table
- `001_schema.sql` - Complete database schema (all 14 tables)

**Migration Tracking:**
- Each migration is recorded in `schema_migrations` table
- `npm run migrate` runs only pending migrations
- `npm run migrate:status` shows applied/pending migrations
- `npm run migrate:rollback` rolls back last migration

**Future Migrations:**
Add new migrations as `002_add_column.sql`, `003_new_table.sql`, etc.
The migration runner executes them in order and tracks state.


### Sample: Pages Table with Full-Text Search

```sql
-- Pages table with full-text search
CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMP,
    search_vector TSVECTOR,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,
    deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(section_id, slug)
);

CREATE INDEX idx_pages_search_vector ON pages USING GIN(search_vector);

-- Trigger to auto-update search_vector
CREATE OR REPLACE FUNCTION pages_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pages_search_vector_trigger
    BEFORE INSERT OR UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION pages_search_vector_update();
```

### Running Migrations

```bash
# Create database, run migrations, and seed data
npm run db:setup

# Or step by step:
npm run db:create       # Create database
npm run migrate         # Run pending migrations (tracks state)
npm run db:seed         # Insert sample data

# Migration management:
npm run migrate:status   # Show applied/pending migrations
npm run migrate:rollback # Rollback last migration
```

**How it works:**
1. `000_migration_tracking.sql` creates `schema_migrations` table
2. `run-migrations.sh` checks which migrations have been applied
3. Only runs pending migrations in order
4. Records each migration in `schema_migrations` table
5. Future migrations (002, 003, etc.) are automatically detected and run

---

## Appendix D: NestJS Project Structure

```
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   └── access-control.guard.ts
│   ├── interceptors/
│   │   └── audit.interceptor.ts
│   └── pipes/
│       └── validation.pipe.ts
├── database/
│   ├── database.module.ts
│   └── database.provider.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── strategies/
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
├── libraries/
│   ├── libraries.module.ts
│   ├── libraries.controller.ts
│   └── libraries.service.ts
├── wikis/
│   ├── wikis.module.ts
│   ├── wikis.controller.ts
│   └── wikis.service.ts
├── sections/
│   ├── sections.module.ts
│   ├── sections.controller.ts
│   └── sections.service.ts
├── pages/
│   ├── pages.module.ts
│   ├── pages.controller.ts
│   ├── pages.service.ts
│   └── dto/
├── files/
│   ├── files.module.ts
│   ├── files.controller.ts
│   └── files.service.ts
├── tags/
│   ├── tags.module.ts
│   ├── tags.controller.ts
│   └── tags.service.ts
├── access-control/
│   ├── access-control.module.ts
│   ├── access-control.service.ts
│   └── access-control.guard.ts
├── search/
│   ├── search.module.ts
│   ├── search.controller.ts
│   └── search.service.ts
└── analytics/
    ├── analytics.module.ts
    └── analytics.service.ts
```

---

## Appendix E: Access Control Implementation

### Access Control Service

```typescript
// src/access-control/access-control.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';

interface User {
  id: number;
  role: 'library_staff' | 'mobius_staff' | 'site_admin';
  library_id: number | null;
}

interface AccessCheckContext {
  user: User | null;
  token?: string;
}

@Injectable()
export class AccessControlService {
  private roleHierarchy = {
    library_staff: 1,
    mobius_staff: 2,
    site_admin: 3,
  };

  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async canAccess(
    ruleableType: 'wiki' | 'section' | 'page' | 'file',
    ruleableId: number,
    context: AccessCheckContext
  ): Promise<boolean> {
    const rules = await this.getRules(ruleableType, ruleableId);

    // No rules on this content—check parent or default public
    if (rules.length === 0) {
      const parent = await this.getParent(ruleableType, ruleableId);
      if (parent) {
        return this.canAccess(parent.type, parent.id, context);
      }
      return true; // No rules anywhere in chain = public
    }

    // Check each rule (OR logic)
    for (const rule of rules) {
      if (this.matchesRule(rule, context)) {
        return true;
      }
    }

    return false;
  }

  private async getRules(ruleableType: string, ruleableId: number) {
    const { rows } = await this.pool.query(
      `SELECT * FROM access_rules 
       WHERE ruleable_type = $1 AND ruleable_id = $2`,
      [ruleableType, ruleableId]
    );
    return rows;
  }

  private async getParent(ruleableType: string, ruleableId: number) {
    if (ruleableType === 'page') {
      const { rows } = await this.pool.query(
        'SELECT section_id FROM pages WHERE id = $1',
        [ruleableId]
      );
      return rows[0] ? { type: 'section' as const, id: rows[0].section_id } : null;
    }
    if (ruleableType === 'section') {
      const { rows } = await this.pool.query(
        'SELECT wiki_id FROM sections WHERE id = $1',
        [ruleableId]
      );
      return rows[0] ? { type: 'wiki' as const, id: rows[0].wiki_id } : null;
    }
    return null; // wikis and files have no parent
  }

  private matchesRule(rule: any, context: AccessCheckContext): boolean {
    const { user, token } = context;

    switch (rule.rule_type) {
      case 'public':
        return true;

      case 'link':
        if (!token) return false;
        if (rule.rule_value !== token) return false;
        if (rule.expires_at && new Date(rule.expires_at) < new Date()) return false;
        return true;

      case 'role':
        if (!user) return false;
        return this.roleHierarchy[user.role] >= this.roleHierarchy[rule.rule_value];

      case 'library':
        if (!user) return false;
        return user.library_id === parseInt(rule.rule_value, 10);

      case 'user':
        if (!user) return false;
        return user.id === parseInt(rule.rule_value, 10);

      default:
        return false;
    }
  }
}
```

### Access Control Guard

```typescript
// src/access-control/access-control.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from './access-control.service';

@Injectable()
export class AccessControlGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private accessControlService: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user || null;
    const token = request.query.token;

    // Determine what resource is being accessed from route params
    const { wikiSlug, sectionSlug, pageSlug } = request.params;

    // Resolve slugs to IDs and check access
    // Implementation depends on your routing structure
    
    return this.accessControlService.canAccess(
      'page', // or determined dynamically
      resourceId,
      { user, token }
    );
  }
}
```

---

## Appendix F: Soft Delete Pattern

### Base Query Helper

```typescript
// src/common/query-helpers.ts
export function withSoftDelete(includeDeleted = false): string {
  return includeDeleted ? '' : 'AND deleted_at IS NULL';
}

// Usage in service
async findAll(includeDeleted = false) {
  const { rows } = await this.pool.query(
    `SELECT * FROM pages WHERE 1=1 ${withSoftDelete(includeDeleted)}`
  );
  return rows;
}
```

### Soft Delete Method

```typescript
async softDelete(id: number, userId: number) {
  const { rows } = await this.pool.query(
    `UPDATE pages 
     SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW(), updated_by = $2
     WHERE id = $1
     RETURNING *`,
    [id, userId]
  );
  return rows[0];
}
```

### Restore Method

```typescript
async restore(id: number, userId: number) {
  const { rows } = await this.pool.query(
    `UPDATE pages 
     SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW(), updated_by = $2
     WHERE id = $1
     RETURNING *`,
    [id, userId]
  );
  return rows[0];
}
```

---

## Appendix G: Authentication & Sessions

### Confirmed Approach

Server-side sessions stored in PostgreSQL. No JWT.

**Why sessions over JWT:**
- Instant logout/invalidation (critical when staff leave or permissions change)
- Permission changes apply immediately
- Simpler implementation for browser-based users
- No mobile app or external API planned

### Sessions Table

```sql
-- Used by connect-pg-simple
CREATE TABLE sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX idx_sessions_expire ON sessions(expire);
```

### Key Libraries

```json
{
  "dependencies": {
    "express-session": "^1.x",
    "connect-pg-simple": "^9.x"
  }
}
```

### Session Configuration

```typescript
// src/main.ts
import * as session from 'express-session';
import pgSession from 'connect-pg-simple';

const PostgresStore = pgSession(session);

app.use(
  session({
    store: new PostgresStore({
      pool: dbPool,
      tableName: 'sessions',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  }),
);
```

### Session Data Structure

```typescript
// What gets stored in sess JSON
interface SessionData {
  userId: number;
  email: string;
  role: 'library_staff' | 'mobius_staff' | 'site_admin';
  libraryId: number | null;
  loginAt: string; // ISO timestamp
}
```

### Auth Service

```typescript
// src/auth/auth.service.ts
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async validateUser(email: string, password: string) {
    const { rows } = await this.pool.query(
      `SELECT id, email, password_hash, name, role, library_id
       FROM users
       WHERE email = $1 AND is_active = true AND deleted_at IS NULL`,
      [email]
    );

    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Return user without password_hash
    const { password_hash, ...result } = user;
    return result;
  }

  async login(req: any, user: any) {
    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.role = user.role;
    req.session.libraryId = user.library_id;
    req.session.loginAt = new Date().toISOString();
  }

  async logout(req: any) {
    return new Promise<void>((resolve, reject) => {
      req.session.destroy((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
```

### Auth Controller

```typescript
// src/auth/auth.controller.ts
import { Controller, Post, Body, Req, Res, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: any,
  ) {
    const user = await this.authService.validateUser(body.email, body.password);
    await this.authService.login(req, user);
    return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: any, @Res() res: Response) {
    await this.authService.logout(req);
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  }

  @Post('me')
  @HttpCode(200)
  async me(@Req() req: any) {
    if (!req.session.userId) {
      return { authenticated: false };
    }
    return {
      authenticated: true,
      user: {
        id: req.session.userId,
        email: req.session.email,
        role: req.session.role,
        libraryId: req.session.libraryId,
      },
    };
  }
}
```

### Auth Guard

```typescript
// src/common/guards/auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    if (!request.session?.userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    
    return true;
  }
}
```

### Role Guard

```typescript
// src/common/guards/role.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RoleGuard implements CanActivate {
  private roleHierarchy = {
    library_staff: 1,
    mobius_staff: 2,
    site_admin: 3,
  };

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRole = this.reflector.get<string>('role', context.getHandler());
    if (!requiredRole) {
      return true; // No role required
    }

    const request = context.switchToHttp().getRequest();
    const userRole = request.session?.role;

    if (!userRole) {
      throw new ForbiddenException('Access denied');
    }

    if (this.roleHierarchy[userRole] < this.roleHierarchy[requiredRole]) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
```

### Role Decorator

```typescript
// src/common/decorators/role.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RequireRole = (role: 'library_staff' | 'mobius_staff' | 'site_admin') =>
  SetMetadata('role', role);
```

### Usage Example

```typescript
// src/users/users.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/role.decorator';

@Controller('users')
@UseGuards(AuthGuard, RoleGuard)
export class UsersController {
  
  @Get()
  @RequireRole('mobius_staff') // Only MOBIUS staff and above can list users
  async findAll() {
    // ...
  }
}
```

### Session Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Default duration | 24 hours | Standard login |
| Remember me duration | 30 days | Extended session when "remember me" checked |
| Cookie httpOnly | true | Prevents JavaScript access (XSS protection) |
| Cookie secure | true (production) | HTTPS only in production |
| Cookie sameSite | lax | CSRF protection |

### Remember Me Implementation

```typescript
// src/auth/auth.controller.ts
@Post('login')
@HttpCode(200)
async login(
  @Body() body: { email: string; password: string; rememberMe?: boolean },
  @Req() req: any,
) {
  const user = await this.authService.validateUser(body.email, body.password);
  
  // Extend session if "remember me" is checked
  if (body.rememberMe) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }
  
  await this.authService.login(req, user);
  return { success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}
```

### Password Requirements

| Requirement | Value |
|-------------|-------|
| Minimum length | 12 characters |
| Maximum length | 128 characters |
| Complexity | At least 1 uppercase, 1 lowercase, 1 number |
| Common passwords | Reject top 10,000 common passwords |
| Bcrypt rounds | 12 |

```typescript
// src/auth/password.util.ts
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < MIN_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_LENGTH} characters` };
  }
  
  if (password.length > MAX_LENGTH) {
    return { valid: false, error: `Password must be less than ${MAX_LENGTH} characters` };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  
  // Optional: Check against common passwords list
  // if (isCommonPassword(password)) {
  //   return { valid: false, error: 'This password is too common' };
  // }
  
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

---

## Appendix H: Edge Case Reference

See: `edge-case-questions.md` for comprehensive edge case analysis used to inform this specification.
