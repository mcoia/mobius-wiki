# Page Versioning

## Overview

Every time a page is created or updated, MOBIUS Wiki automatically creates a complete snapshot in the version history. This provides:

- Complete audit trail of changes
- Ability to view historical content
- Future rollback capability (infrastructure ready)
- Immutable history (versions are never deleted)

---

## How Versioning Works

### Automatic Version Creation

Versions are created automatically in two scenarios:

**1. Page Creation:**
```bash
POST /api/v1/sections/1/pages
{
  "title": "New Page",
  "content": "<p>Initial content</p>"
}
```
→ Creates Page (id=100) + Version 1

**2. Page Update:**
```bash
PATCH /api/v1/pages/100
{
  "content": "<p>Updated content</p>"
}
```
→ Creates Version 2

### Version Numbering

Versions are numbered sequentially per page:
- First version: 1
- Second version: 2
- Third version: 3
- etc.

Each page has its own version counter (page 1 and page 2 both start at version 1).

### Full Snapshot Storage

Each version stores:
- `id` - Version record ID
- `pageId` - Parent page reference
- `content` - **Complete HTML snapshot**
- `title` - Page title at time of save
- `versionNumber` - Sequential version number
- `createdAt` - When version was created
- `createdBy` - User who made the change

⚠️ **Important:** Versions store the **entire HTML content**, not diffs. This makes retrieval fast but uses more storage.

---

## Version API Endpoints

### GET /api/v1/pages/:id/versions

List all versions for a page.

**Authentication Required:** No

**Path Parameters:**
- `id` - Page ID

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 50,
      "pageId": 1,
      "versionNumber": 2,
      "title": "Welcome to Folio",
      "content": "<h1>Welcome to Folio</h1><p>Updated content v2</p>",
      "createdAt": "2025-01-15T14:00:00Z",
      "createdBy": 41
    },
    {
      "id": 49,
      "pageId": 1,
      "versionNumber": 1,
      "title": "Welcome to Folio",
      "content": "<h1>Welcome to Folio</h1><p>Original content v1</p>",
      "createdAt": "2025-01-15T10:00:00Z",
      "createdBy": 41
    }
  ],
  "meta": {
    "total": 2
  }
}
```

**curl Example:**
```bash
curl http://localhost:10000/api/v1/pages/1/versions | jq
```

**Notes:**
- Versions ordered by version_number DESC (newest first)
- Returns ALL versions (no pagination currently)
- Includes full content in each version

---

### GET /api/v1/pages/:id/versions/:versionNumber

Get a specific version of a page.

**Authentication Required:** No

**Path Parameters:**
- `id` - Page ID
- `versionNumber` - Version number (integer)

**Success Response (200 OK):**
```json
{
  "id": 49,
  "pageId": 1,
  "versionNumber": 1,
  "title": "Welcome to Folio",
  "content": "<h1>Welcome to Folio</h1><p>Original content v1</p>",
  "createdAt": "2025-01-15T10:00:00Z",
  "createdBy": 41
}
```

**Error Responses:**
- `404 Not Found` - Page doesn't exist or version doesn't exist

**curl Example:**
```bash
curl http://localhost:10000/api/v1/pages/1/versions/1 | jq
```

---

## Versioning Workflow

### Creating and Publishing a Page

```bash
# Step 1: Create draft page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/1/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Guide",
    "content": "<h1>Draft Content</h1>",
    "status": "draft"
  }' | jq '.id'
# Returns: 100
# Version 1 created automatically

# Step 2: Update draft
curl -b cookies.txt -X PATCH http://localhost:10000/api/v1/pages/100 \
  -H "Content-Type: application/json" \
  -d '{
    "content": "<h1>Updated Draft</h1><p>More content</p>"
  }'
# Version 2 created automatically

# Step 3: Publish
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/100/publish
# Version 3 created automatically
# status changed to "published"
# publishedAt set to NOW()

# Step 4: Make edits after publish
curl -b cookies.txt -X PATCH http://localhost:10000/api/v1/pages/100 \
  -H "Content-Type: application/json" \
  -d '{"content": "<h1>Post-publish update</h1>"}'
# Version 4 created

# Step 5: View version history
curl http://localhost:10000/api/v1/pages/100/versions | jq '.meta.total'
# Returns: 4
```

---

## Version Comparison (Future Feature)

The infrastructure is ready for version comparison and rollback:

### Current State

```sql
-- Get two versions
SELECT content FROM wiki.page_versions WHERE page_id = 100 AND version_number = 1;
SELECT content FROM wiki.page_versions WHERE page_id = 100 AND version_number = 2;
```

You can manually diff the content.

### Future Enhancement

Planned endpoints (not yet implemented):
- `GET /pages/:id/versions/:v1/compare/:v2` - Show diff between versions
- `POST /pages/:id/rollback/:versionNumber` - Restore old version (creates new version)

---

## Version Storage Considerations

### Storage Impact

Each version stores complete HTML:

```
Page: 50 KB of HTML
Versions: 10
Total storage: 500 KB
```

For large wikis with frequent edits, this can grow significantly.

### Optimization Strategies (Future)

1. **Diff-based storage** - Store deltas instead of full snapshots
2. **Version pruning** - Keep first/last/published, compress others
3. **Content deduplication** - Hash-based storage for identical content

Current implementation prioritizes simplicity and retrieval speed over storage efficiency.

---

## Immutable History

Versions are **never deleted**:

- Page soft-delete → Page hidden, versions remain
- Page hard-delete → Foreign key prevents deletion
- User delete → versions.created_by set to NULL (ON DELETE SET NULL)

This ensures audit trail integrity.

---

## Database Schema

### page_versions Table

```sql
CREATE TABLE wiki.page_versions (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES wiki.pages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  title VARCHAR(500) NOT NULL,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
  UNIQUE(page_id, version_number)
);

CREATE INDEX idx_page_versions_page_id ON wiki.page_versions(page_id);
CREATE INDEX idx_page_versions_created_at ON wiki.page_versions(created_at);
```

**Key constraints:**
- UNIQUE(page_id, version_number) - No duplicate version numbers
- Foreign key CASCADE on page_id - Delete versions if page hard-deleted
- Foreign key SET NULL on created_by - Preserve history even if user deleted

---

## Use Cases

### Viewing Historical Content

Frontend can display a "Version History" panel:

```typescript
// Get all versions
const response = await fetch('/api/v1/pages/1/versions');
const { data: versions } = await response.json();

// Display timeline
versions.forEach(v => {
  console.log(`Version ${v.versionNumber} - ${v.createdAt} by User ${v.createdBy}`);
});

// Load specific version
const v1 = await fetch('/api/v1/pages/1/versions/1');
const version1 = await v1.json();
console.log(version1.content);  // Original content
```

### Comparing Versions (Manual)

```bash
# Get version 1
curl http://localhost:10000/api/v1/pages/1/versions/1 | jq -r '.content' > v1.html

# Get version 2
curl http://localhost:10000/api/v1/pages/1/versions/2 | jq -r '.content' > v2.html

# Diff
diff v1.html v2.html
```

### Audit Trail

```bash
# Who made changes to page 1?
curl http://localhost:10000/api/v1/pages/1/versions | jq '.data[] | {version: .versionNumber, createdBy: .createdBy, createdAt: .createdAt}'
```

---

## Related Documentation

- [Content Management](./04-content-management.md) - Creating and updating pages
- [Examples](./10-examples.md) - Complete workflows with versioning
