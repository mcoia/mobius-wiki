# Content Management API

## Overview

MOBIUS Wiki organizes content in a three-level hierarchy:

```
Wiki (e.g., "Folio", "OpenRS")
  └── Section (e.g., "Getting Started", "Advanced Topics")
      └── Page (e.g., "First Login", "Configuration Guide")
```

Each level has full CRUD operations with soft delete support.

---

## Content Hierarchy

### Wikis

Top-level containers for related documentation.

**Properties:**
- `id` - Unique identifier
- `title` - Display name
- `slug` - URL-safe identifier (auto-generated from title)
- `description` - Optional description
- `sortOrder` - Display order (default: 0)
- `createdAt`, `updatedAt` - Timestamps
- `createdBy`, `updatedBy` - User IDs
- `deletedAt`, `deletedBy` - Soft delete fields

### Sections

Organizational groupings within a wiki.

**Properties:**
- Same as wikis, plus:
- `wikiId` - Parent wiki reference

**Slug Uniqueness:** Section slugs are unique within each wiki (not globally).

### Pages

The actual content with full-text search and versioning.

**Properties:**
- Same as sections, plus:
- `sectionId` - Parent section reference
- `content` - HTML content from WYSIWYG editor
- `status` - `draft` or `published`
- `publishedAt` - Timestamp when first published
- `searchVector` - Full-text search index (auto-updated)

**Slug Uniqueness:** Page slugs are unique within each section.

---

## Wikis API

### GET /api/v1/wikis

List all wikis accessible to the current user.

**Authentication Required:** No (but results filtered by ACL)

**Query Parameters:**
- `includeDeleted` (optional) - Include soft-deleted wikis (default: false)

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Folio",
      "slug": "folio",
      "description": "Folio ILS Documentation",
      "sortOrder": 0,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z",
      "createdBy": 41,
      "updatedBy": 41,
      "deletedAt": null,
      "deletedBy": null
    }
  ],
  "meta": {
    "total": 23
  }
}
```

**curl Example:**
```bash
curl http://localhost:10000/api/v1/wikis | jq
```

**Notes:**
- Results are filtered by ACL (only shows wikis user can access)
- Guests see fewer wikis than authenticated users
- Soft-deleted wikis excluded by default

---

### GET /api/v1/wikis/:id

Get a single wiki by ID.

**Authentication Required:** Depends on wiki's ACL (AccessControlGuard)

**Path Parameters:**
- `id` - Wiki ID (integer)

**Success Response (200 OK):**
```json
{
  "id": 1,
  "title": "Folio",
  "slug": "folio",
  "description": "Folio ILS Documentation",
  "sortOrder": 0,
  "createdAt": "2025-01-15T10:00:00Z",
  "updatedAt": "2025-01-15T10:00:00Z",
  "createdBy": 41,
  "updatedBy": 41,
  "deletedAt": null,
  "deletedBy": null
}
```

**Error Responses:**
- `403 Forbidden` - User doesn't have access (ACL denied)
- `404 Not Found` - Wiki doesn't exist or is soft-deleted

**curl Example:**
```bash
curl http://localhost:10000/api/v1/wikis/1 | jq
```

---

### GET /api/v1/wikis/slug/:slug

Get a wiki by its slug.

**Authentication Required:** No

**Path Parameters:**
- `slug` - Wiki slug (string)

**Success Response (200 OK):**
Same as GET by ID

**Error Responses:**
- `404 Not Found` - Wiki with slug doesn't exist

**curl Example:**
```bash
curl http://localhost:10000/api/v1/wikis/slug/folio | jq
```

---

### POST /api/v1/wikis

Create a new wiki.

**Authentication Required:** Yes (AuthGuard)

**Request Body:**
```json
{
  "title": "New Wiki",
  "slug": "new-wiki",
  "description": "Optional description",
  "sortOrder": 0
}
```

**Field Details:**
- `title` (required) - Wiki title
- `slug` (optional) - Auto-generated from title if not provided
- `description` (optional) - Wiki description
- `sortOrder` (optional) - Display order (default: 0)

**Success Response (201 Created):**
```json
{
  "id": 31,
  "title": "New Wiki",
  "slug": "new-wiki",
  "description": "Optional description",
  "sortOrder": 0,
  "createdAt": "2025-01-15T14:30:00Z",
  "updatedAt": "2025-01-15T14:30:00Z",
  "createdBy": 41,
  "updatedBy": 41,
  "deletedAt": null,
  "deletedBy": null
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `409 Conflict` - Wiki with slug already exists
- `400 Bad Request` - Validation errors

**curl Example:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Wiki",
    "description": "My new wiki"
  }'
```

---

### PATCH /api/v1/wikis/:id

Update an existing wiki.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `id` - Wiki ID

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "slug": "updated-slug",
  "description": "Updated description",
  "sortOrder": 10
}
```

**Success Response (200 OK):**
Returns updated wiki object.

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Wiki doesn't exist
- `409 Conflict` - New slug already in use

**curl Example:**
```bash
curl -b cookies.txt -X PATCH http://localhost:10000/api/v1/wikis/1 \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated description"
  }'
```

---

### DELETE /api/v1/wikis/:id

Soft-delete a wiki.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `id` - Wiki ID

**Success Response (200 OK):**
Returns deleted wiki object with `deletedAt` and `deletedBy` populated.

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Wiki doesn't exist or already deleted

**curl Example:**
```bash
curl -b cookies.txt -X DELETE http://localhost:10000/api/v1/wikis/1
```

**Notes:**
- Sets `deleted_at = NOW()` and `deleted_by = userId`
- Wiki still exists in database but hidden from normal queries
- Child sections and pages are NOT automatically deleted (must delete separately)
- Can be restored by setting `deleted_at = NULL` (requires database access)

---

## Sections API

### GET /api/v1/wikis/:wikiId/sections

List all sections in a wiki.

**Authentication Required:** No (filtered by ACL)

**Path Parameters:**
- `wikiId` - Parent wiki ID

**Query Parameters:**
- `includeDeleted` (optional) - Include soft-deleted sections

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "wikiId": 1,
      "title": "Getting Started",
      "slug": "getting-started",
      "description": "Introduction and setup guides",
      "sortOrder": 0,
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z",
      "createdBy": 41,
      "updatedBy": 41,
      "deletedAt": null,
      "deletedBy": null
    }
  ],
  "meta": {
    "total": 5
  }
}
```

**Error Responses:**
- `404 Not Found` - Parent wiki doesn't exist

**curl Example:**
```bash
curl http://localhost:10000/api/v1/wikis/1/sections | jq
```

---

### GET /api/v1/sections/:id

Get a single section by ID.

**Authentication Required:** Depends on ACL (AccessControlGuard)

**Path Parameters:**
- `id` - Section ID

**Success Response (200 OK):**
Same structure as list item above.

**Error Responses:**
- `403 Forbidden` - ACL denied
- `404 Not Found` - Section doesn't exist

**curl Example:**
```bash
curl http://localhost:10000/api/v1/sections/1 | jq
```

---

### POST /api/v1/wikis/:wikiId/sections

Create a new section in a wiki.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `wikiId` - Parent wiki ID

**Request Body:**
```json
{
  "title": "Advanced Topics",
  "slug": "advanced-topics",
  "description": "Advanced configuration and troubleshooting",
  "sortOrder": 10
}
```

**Success Response (201 Created):**
Returns created section object.

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Parent wiki doesn't exist
- `409 Conflict` - Section with slug already exists in this wiki

**curl Example:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/1/sections \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Advanced Topics",
    "description": "For power users"
  }'
```

---

### PATCH /api/v1/sections/:id

Update an existing section.

**Authentication Required:** Yes (AuthGuard)

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "slug": "updated-slug",
  "description": "New description",
  "sortOrder": 5
}
```

**curl Example:**
```bash
curl -b cookies.txt -X PATCH http://localhost:10000/api/v1/sections/1 \
  -H "Content-Type: application/json" \
  -d '{"sortOrder": 5}'
```

---

### DELETE /api/v1/sections/:id

Soft-delete a section.

**Authentication Required:** Yes (AuthGuard)

**curl Example:**
```bash
curl -b cookies.txt -X DELETE http://localhost:10000/api/v1/sections/1
```

---

## Pages API

### GET /api/v1/sections/:sectionId/pages

List all pages in a section.

**Authentication Required:** No (filtered by ACL)

**Path Parameters:**
- `sectionId` - Parent section ID

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "sectionId": 1,
      "title": "Welcome to Folio",
      "slug": "welcome-to-folio",
      "content": "<h1>Welcome</h1><p>This is your guide...</p>",
      "status": "published",
      "sortOrder": 0,
      "publishedAt": "2025-01-15T12:00:00Z",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T12:00:00Z",
      "createdBy": 41,
      "updatedBy": 41,
      "deletedAt": null,
      "deletedBy": null
    }
  ],
  "meta": {
    "total": 10
  }
}
```

**curl Example:**
```bash
curl http://localhost:10000/api/v1/sections/1/pages | jq
```

---

### GET /api/v1/pages/:id

Get a single page by ID.

**Authentication Required:** Depends on ACL (AccessControlGuard)

**Path Parameters:**
- `id` - Page ID

**Success Response (200 OK):**
Same structure as list item above.

**Error Responses:**
- `403 Forbidden` - ACL denied
- `404 Not Found` - Page doesn't exist

**curl Example:**
```bash
curl http://localhost:10000/api/v1/pages/1 | jq
```

**Note:** This endpoint automatically tracks a page view in analytics (via PageViewInterceptor).

---

### POST /api/v1/sections/:sectionId/pages

Create a new page in a section.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `sectionId` - Parent section ID

**Request Body:**
```json
{
  "title": "New Page",
  "slug": "new-page",
  "content": "<h1>Hello World</h1><p>Page content here</p>",
  "status": "draft",
  "sortOrder": 0
}
```

**Field Details:**
- `title` (required) - Page title
- `slug` (optional) - Auto-generated if not provided
- `content` (required) - HTML content
- `status` (optional) - `draft` or `published` (default: `draft`)
- `sortOrder` (optional) - Display order (default: 0)

**Success Response (201 Created):**
```json
{
  "id": 100,
  "sectionId": 1,
  "title": "New Page",
  "slug": "new-page",
  "content": "<h1>Hello World</h1><p>Page content here</p>",
  "status": "draft",
  "sortOrder": 0,
  "publishedAt": null,
  "createdAt": "2025-01-15T14:30:00Z",
  "updatedAt": "2025-01-15T14:30:00Z",
  "createdBy": 41,
  "updatedBy": 41,
  "deletedAt": null,
  "deletedBy": null
}
```

**Error Responses:**
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Parent section doesn't exist
- `409 Conflict` - Page with slug already exists in this section
- `400 Bad Request` - Validation errors

**curl Example:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/1/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My New Page",
    "content": "<h1>Hello</h1><p>Content here</p>",
    "status": "draft"
  }'
```

**What happens:**
1. Page created in database
2. Slug auto-generated if not provided
3. Initial version (v1) automatically created
4. `publishedAt` remains NULL for drafts
5. `searchVector` auto-populated via database trigger

---

### PATCH /api/v1/pages/:id

Update an existing page.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `id` - Page ID

**Request Body:** (all fields optional)
```json
{
  "title": "Updated Title",
  "slug": "updated-slug",
  "content": "<h1>Updated</h1><p>New content</p>",
  "status": "draft"
}
```

**Success Response (200 OK):**
Returns updated page object.

**curl Example:**
```bash
curl -b cookies.txt -X PATCH http://localhost:10000/api/v1/pages/1 \
  -H "Content-Type: application/json" \
  -d '{
    "content": "<h1>Updated Content</h1>"
  }'
```

**What happens:**
1. Page updated in database
2. New version created automatically
3. `updatedAt` and `updatedBy` refreshed
4. `searchVector` auto-updated via trigger

---

### POST /api/v1/pages/:id/publish

Publish a draft page.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `id` - Page ID

**Request Body:** None

**Success Response (200 OK):**
```json
{
  "id": 1,
  "status": "published",
  "publishedAt": "2025-01-15T15:00:00Z",
  ...
}
```

**curl Example:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/1/publish
```

**What happens:**
1. Page status changed to `published`
2. `publishedAt` set to NOW() (if first publish)
3. New version created
4. Page becomes searchable (if ACL allows)

---

### DELETE /api/v1/pages/:id

Soft-delete a page.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `id` - Page ID

**Success Response (200 OK):**
Returns deleted page object with `deletedAt` and `deletedBy` populated.

**curl Example:**
```bash
curl -b cookies.txt -X DELETE http://localhost:10000/api/v1/pages/1
```

**Notes:**
- Page versions are NOT deleted (permanent history)
- Page no longer appears in lists
- Page no longer appears in search results
- Can be queried with `?includeDeleted=true` (admin feature)

---

## Slug Generation

### How Slugs Work

Slugs are URL-safe identifiers auto-generated from titles:

```typescript
function generateSlug(title: string): string {
  return title
    .toLowerCase()                  // "My Page" → "my page"
    .trim()                         // Remove whitespace
    .replace(/[^\w\s-]/g, '')       // Remove special chars
    .replace(/[\s_]+/g, '-')        // Spaces to hyphens
    .replace(/^-+|-+$/g, '');       // Trim hyphens
}

// Examples:
"Getting Started" → "getting-started"
"FAQ & Help!" → "faq-help"
"Version 2.0 Release" → "version-20-release"
```

### Slug Uniqueness

Slugs are unique within their parent:

- Wiki slugs: Globally unique
- Section slugs: Unique per wiki (different wikis can have "getting-started")
- Page slugs: Unique per section

**Example:**
```
Wiki "Folio" can have:
  Section "Getting Started"
    Page "First Login"

Wiki "OpenRS" can also have:
  Section "Getting Started"  ← Same slug, different wiki, OK!
    Page "First Login"       ← Same slug, different section, OK!
```

### Changing Slugs

When you update a slug, the old URL breaks. Future enhancement: create redirect in `wiki.redirects` table (schema exists, logic not yet implemented).

---

## Soft Delete Behavior

### What is Soft Delete?

Instead of permanently removing content, we set `deleted_at = NOW()` and `deleted_by = user_id`. The content stays in the database but is hidden from normal queries.

### Soft Delete Fields

All soft-deletable tables have:
```typescript
deleted_at: TIMESTAMP | null
deleted_by: INTEGER | null  // References users.id
```

### Querying Deleted Content

**Default (excludes deleted):**
```bash
curl http://localhost:10000/api/v1/wikis
```

**Include deleted:**
```bash
curl http://localhost:10000/api/v1/wikis?includeDeleted=true
```

**SQL difference:**
```sql
-- Default
SELECT * FROM wiki.wikis WHERE deleted_at IS NULL

-- With includeDeleted
SELECT * FROM wiki.wikis
```

### What Gets Soft-Deleted?

Tables with soft delete:
- ✅ libraries
- ✅ users
- ✅ wikis
- ✅ sections
- ✅ pages
- ✅ files

Tables WITHOUT soft delete (permanent):
- ❌ page_versions (history must be immutable)
- ❌ tags
- ❌ page_tags
- ❌ file_links
- ❌ access_rules
- ❌ page_views
- ❌ redirects
- ❌ sessions

---

## Response Format

All endpoints follow a consistent format:

### Success Response (Single Resource)

```json
{
  "data": {
    "id": 1,
    "title": "...",
    ...
  }
}
```

### Success Response (Collection)

```json
{
  "data": [
    { "id": 1, ... },
    { "id": 2, ... }
  ],
  "meta": {
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "statusCode": 404,
  "message": "Page with ID 999 not found",
  "error": "Not Found"
}
```

---

## Complete Workflow Example

### Creating a Full Content Hierarchy

```bash
# Step 1: Login
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mobius.org", "password": "admin123"}'

# Step 2: Create Wiki
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis \
  -H "Content-Type: application/json" \
  -d '{"title": "My Wiki", "description": "Documentation hub"}' \
  | jq '.id'
# Returns: 31

# Step 3: Create Section
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/31/sections \
  -H "Content-Type: application/json" \
  -d '{"title": "Getting Started", "sortOrder": 0}' \
  | jq '.id'
# Returns: 45

# Step 4: Create Page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/45/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "First Steps",
    "content": "<h1>Welcome</h1><p>Start here...</p>",
    "status": "draft"
  }' | jq '.id'
# Returns: 200

# Step 5: Publish Page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/200/publish

# Step 6: Make Wiki Public
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/31/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "public"}'

# Step 7: Verify Guest Access
curl http://localhost:10000/api/v1/pages/200
# Expected: 200 OK (page inherits public from wiki)
```

---

## Related Documentation

- [ACL System](./03-acl-system.md) - Access control and permissions
- [Page Versioning](./05-page-versioning.md) - Version history
- [Search API](./07-search.md) - Finding content
- [Error Handling](./09-error-handling.md) - Error codes and formats
