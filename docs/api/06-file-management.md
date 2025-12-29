# File Management

## Overview

MOBIUS Wiki supports file uploads with polymorphic linking - files can be attached to wikis, sections, pages, or users. File access uses a "**most restrictive wins**" model combining file ACL with linked content ACL.

---

## File Upload

### POST /api/v1/files

Upload a file to the system.

**Authentication Required:** Yes (AuthGuard)

**Request Format:** `multipart/form-data`

**Form Fields:**
- `file` (required) - The file to upload
- `description` (optional) - File description

**Success Response (201 Created):**
```json
{
  "data": {
    "id": 81,
    "filename": "test-file.txt",
    "storage_path": "uploads/test-file.txt_69f17f68e12ae8a622d1d8a0d14a97ec.txt",
    "mime_type": "text/plain",
    "size_bytes": 52,
    "uploaded_by": 41,
    "uploaded_at": "2025-12-19T23:18:03.180Z",
    "created_at": "2025-12-19T23:18:03.180Z",
    "updated_at": "2025-12-19T23:18:03.180Z",
    "deleted_at": null,
    "deleted_by": null
  }
}
```

**curl Example:**
```bash
curl -b cookies.txt -F "file=@/path/to/document.pdf" \
  -F "description=User manual PDF" \
  http://localhost:10000/api/v1/files
```

**What happens:**
1. File buffer received via multer
2. Unique filename generated: `original_name_[random_hash].ext`
3. File saved to `backend/uploads/` directory
4. Metadata saved to `wiki.files` table
5. Returns file record with ID for linking

---

## File Retrieval

### GET /api/v1/files

List all files.

**Authentication Required:** No (but ACL applies)

**Query Parameters:**
- `includeDeleted` (optional) - Include soft-deleted files

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 81,
      "filename": "test-file.txt",
      "storage_path": "uploads/test-file.txt_69f17f68...",
      "mime_type": "text/plain",
      "size_bytes": 52,
      "uploaded_by": 41,
      "uploaded_at": "2025-12-19T23:18:03.180Z",
      ...
    }
  ],
  "meta": {
    "total": 82
  }
}
```

**curl Example:**
```bash
curl http://localhost:10000/api/v1/files | jq
```

---

### GET /api/v1/files/:id

Get file metadata.

**Authentication Required:** Depends on ACL (AccessControlGuard)

**Path Parameters:**
- `id` - File ID

**Success Response (200 OK):**
Same structure as list item.

**Error Responses:**
- `403 Forbidden` - User doesn't have access (see ACL logic below)
- `404 Not Found` - File doesn't exist

**curl Example:**
```bash
curl http://localhost:10000/api/v1/files/81 | jq
```

---

### GET /api/v1/files/:id/download

Download the actual file.

**Authentication Required:** Depends on ACL (AccessControlGuard)

**Path Parameters:**
- `id` - File ID

**Success Response (200 OK):**
- Binary file data
- Headers:
  - `Content-Type`: File's MIME type
  - `Content-Disposition`: `attachment; filename="original_name.ext"`
  - `Content-Length`: File size in bytes

**curl Example:**
```bash
curl -O http://localhost:10000/api/v1/files/81/download
```

**Browser Example:**
```html
<a href="/api/v1/files/81/download">Download User Manual</a>
```

---

## File Deletion

### DELETE /api/v1/files/:id

Soft-delete a file.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `id` - File ID

**Success Response (200 OK):**
Returns deleted file object with `deletedAt` and `deletedBy` populated.

**curl Example:**
```bash
curl -b cookies.txt -X DELETE http://localhost:10000/api/v1/files/81
```

**What happens:**
1. `deleted_at` set to NOW()
2. `deleted_by` set to current user ID
3. File hidden from normal queries
4. **Physical file remains on disk** (manual cleanup needed)
5. File links remain in database but file is inaccessible

---

## Polymorphic File Linking

Files can be linked to four types of content:

- **wikis** - Wiki-level attachments
- **sections** - Section-level resources
- **pages** - Page attachments (most common)
- **users** - User profile pictures, personal files

### POST /api/v1/files/:fileId/link/:type/:id

Link a file to content.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `fileId` - File ID
- `type` - Content type (`wikis`, `sections`, `pages`, or `users`)
- `id` - Content ID

**Success Response (201 Created):**
```json
{
  "data": {
    "id": 86,
    "file_id": 81,
    "linkable_type": "page",
    "linkable_id": 34,
    "created_at": "2025-12-19T23:18:13.601Z",
    "created_by": 41
  }
}
```

**curl Examples:**
```bash
# Link file to page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/81/link/pages/34

# Link file to wiki
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/81/link/wikis/1

# Link file to user (profile picture)
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/100/link/users/41
```

**What happens:**
1. File link record created in `wiki.file_links` table
2. File can now be accessed via linked content's ACL
3. Multiple links allowed (one file → many content items)

---

### DELETE /api/v1/files/:fileId/link/:type/:id

Unlink a file from content.

**Authentication Required:** Yes (AuthGuard)

**Path Parameters:**
- `fileId` - File ID
- `type` - Content type
- `id` - Content ID

**Success Response (200 OK):**
Returns deleted link record.

**Error Responses:**
- `404 Not Found` - Link doesn't exist

**curl Example:**
```bash
curl -b cookies.txt -X DELETE \
  http://localhost:10000/api/v1/files/81/link/pages/34
```

---

### GET /api/v1/files/linked/:type/:id

Get all files linked to a piece of content.

**Authentication Required:** No

**Path Parameters:**
- `type` - Content type (`wikis`, `sections`, `pages`, or `users`)
- `id` - Content ID

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 81,
      "filename": "user-manual.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 1024000,
      "storage_path": "uploads/user-manual.pdf_abc123...",
      "linked_at": "2025-12-19T23:18:13.601Z",
      "linked_by": 41,
      ...
    }
  ],
  "meta": {
    "total": 1
  }
}
```

**curl Example:**
```bash
# Get all files linked to page 34
curl http://localhost:10000/api/v1/files/linked/pages/34 | jq
```

**Frontend use case:**
```html
<!-- Display attachments for a page -->
<h3>Attachments</h3>
<ul>
  <li><a href="/api/v1/files/81/download">user-manual.pdf</a> (1.0 MB)</li>
</ul>
```

---

## File Access Control

### The Two-Part Check

File access uses "**most restrictive wins**" logic. To access a file, users must pass BOTH checks:

```
✅ Check 1: Can user access the FILE itself?
    ↓
✅ Check 2: Can user access at least ONE linked content?
    ↓
  GRANTED
```

### Algorithm

```typescript
function canAccessFile(user, fileId, token) {
  // Part 1: Check file's ACL
  const fileRules = getRules('file', fileId);

  if (fileRules.length > 0) {
    // File has rules, check them
    if (!anyRuleMatches(fileRules, user, token)) {
      return false;  // ❌ File access denied
    }
  }
  // File has no rules or user matched = file OK

  // Part 2: Check linked content
  const links = getFileLinks(fileId);

  if (links.length === 0) {
    return true;  // ✅ No links = file rules alone
  }

  // User must access at least ONE linked content
  for (const link of links) {
    if (canAccess(user, link.type, link.id, token)) {
      return true;  // ✅ Can access this linked content
    }
  }

  return false;  // ❌ Can't access any linked content
}
```

### Examples

**Example 1: Public File + Public Page**
```
File 81: no rules (public)
Linked to: Page 34 (public rule)

Guest access File 81:
  ✅ File check: public (no rules)
  ✅ Content check: Page 34 is public
  → GRANTED
```

**Example 2: Public File + Private Page**
```
File 82: no rules (public)
Linked to: Page 33 (link token only)

Guest access File 82 (no token):
  ✅ File check: public (no rules)
  ❌ Content check: Page 33 requires token
  → DENIED
```

**Example 3: Multiple Links (OR Logic)**
```
File 85: no rules
Linked to:
  - Page 33 (link token) - Guest can't access
  - Page 34 (public) - Guest CAN access

Guest access File 85:
  ✅ File check: public
  ✅ Content check: Can access at least one (Page 34)
  → GRANTED (only need access to ONE linked content)
```

**Example 4: File with Own Rules**
```
File 90: role=library_staff
Linked to: Page 50 (public)

Guest access File 90:
  ❌ File check: Guest < library_staff
  → DENIED (didn't even check linked content)

Library Staff access File 90:
  ✅ File check: library_staff >= library_staff
  ✅ Content check: Page 50 is public
  → GRANTED
```

### Why This Design?

**Problem it solves:**
```
Without "most restrictive":
  Sensitive file + public page = Anyone can access file
  Risk: Data breach via public page attachment

With "most restrictive":
  Sensitive file + public page = Only authorized users can access
  Protection: File rules enforced regardless of page visibility
```

---

## Complete File Workflow

### Upload → Link → Share → Download

```bash
# Step 1: Login
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mobius.org", "password": "admin123"}'

# Step 2: Upload file
curl -b cookies.txt -F "file=@user-guide.pdf" \
  http://localhost:10000/api/v1/files | jq '.data.id'
# Returns: 81

# Step 3: Link file to page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/81/link/pages/34

# Step 4: Verify link
curl http://localhost:10000/api/v1/files/linked/pages/34 | jq '.data[].filename'
# Returns: "user-guide.pdf"

# Step 5: Download file (as guest, if page is public)
curl -O http://localhost:10000/api/v1/files/81/download
```

---

## File Storage

### Local Disk Storage

Files are stored in `backend/uploads/` directory:

```
backend/uploads/
├── test-file.txt_69f17f68e12ae8a622d1d8a0d14a97ec.txt
├── document.pdf_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.pdf
└── image.png_f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8.png
```

**Filename format:**
```
{original_filename}_{random_hash}{extension}
```

**Random hash:** 16 bytes = 32 hex characters (prevents collisions)

### Database Metadata

Stored in `wiki.files` table:

```typescript
{
  id: 81,
  filename: "test-file.txt",                    // Original filename
  storage_path: "uploads/test-file.txt_69f1...",// Actual file path
  mime_type: "text/plain",                      // Content type
  size_bytes: 52,                               // File size
  uploaded_by: 41,                              // User ID
  uploaded_at: "2025-12-19T23:18:03.180Z",     // Upload timestamp
  deleted_at: null                              // Soft delete
}
```

### File Size Limits

Currently no enforced limits (future enhancement).

**Recommended limits:**
- Images: 2 MB
- Documents: 10 MB
- Videos: 100 MB

---

## Polymorphic File Links

### What is Polymorphic Linking?

One file can be linked to multiple content items of different types:

```
File 100 "company-logo.png" linked to:
  ├── Wiki 1 (as logo)
  ├── Page 42 (embedded in content)
  └── User 17 (as profile picture)
```

### Database Schema

```sql
CREATE TABLE wiki.file_links (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES wiki.files(id) ON DELETE CASCADE,
  linkable_type VARCHAR(20) NOT NULL CHECK (...),
  linkable_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES wiki.users(id)
);
```

**Supported linkable types:**
- `wiki`
- `section`
- `page`
- `user`

---

## File Access Examples

### Scenario 1: Public File Attached to Public Page

```bash
# Upload file
curl -b cookies.txt -F "file=@guide.pdf" http://localhost:10000/api/v1/files
# Response: id=100

# Link to public page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/files/100/link/pages/34
# (Page 34 has public rule)

# Guest downloads file
curl -O http://localhost:10000/api/v1/files/100/download
# Result: ✅ SUCCESS (file has no rules + page is public)
```

---

### Scenario 2: Public File Attached to Private Page

```bash
# Upload file
curl -b cookies.txt -F "file=@internal.pdf" http://localhost:10000/api/v1/files
# Response: id=101

# Link to staff-only page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/files/101/link/pages/1
# (Page 1 has role=library_staff rule)

# Guest tries to download
curl http://localhost:10000/api/v1/files/101/download
# Result: ❌ 403 Forbidden (can't access linked page)

# Library staff downloads
curl -b staff_cookies.txt http://localhost:10000/api/v1/files/101/download
# Result: ✅ SUCCESS (has library_staff role)
```

---

### Scenario 3: Private File with Own Rules

```bash
# Upload file
curl -b cookies.txt -F "file=@sensitive.pdf" http://localhost:10000/api/v1/files
# Response: id=102

# Add role rule to file
curl -b cookies.txt -X POST http://localhost:10000/api/v1/files/102/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "role", "ruleValue": "mobius_staff"}'

# Link to public page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/files/102/link/pages/34

# Guest tries to access
curl http://localhost:10000/api/v1/files/102
# Result: ❌ 403 Forbidden (file requires mobius_staff)

# Library staff tries to access
curl -b lib_cookies.txt http://localhost:10000/api/v1/files/102
# Result: ❌ 403 Forbidden (library_staff < mobius_staff)

# MOBIUS staff accesses
curl -b staff_cookies.txt http://localhost:10000/api/v1/files/102
# Result: ✅ SUCCESS (mobius_staff >= mobius_staff AND page is public)
```

---

### Scenario 4: File Linked to Multiple Pages

```bash
# Upload file
curl -b cookies.txt -F "file=@shared-doc.pdf" http://localhost:10000/api/v1/files
# Response: id=103

# Link to private page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/103/link/pages/33
# (Page 33: link token only)

# Link to public page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/103/link/pages/34
# (Page 34: public)

# Guest access file (no token)
curl http://localhost:10000/api/v1/files/103
# Result: ✅ SUCCESS
# Why? File has no rules (public)
#      File is linked to Page 34 (public)
#      User only needs access to ONE linked content
```

---

## Frontend Integration

### Uploading Files

```typescript
async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('description', 'User manual');

  const response = await fetch('http://localhost:10000/api/v1/files', {
    method: 'POST',
    credentials: 'include',
    body: formData  // Don't set Content-Type header (browser does it)
  });

  const { data } = await response.json();
  return data.id;  // File ID for linking
}
```

### Linking Files to Pages

```typescript
async function linkFileToPage(fileId: number, pageId: number) {
  const response = await fetch(
    `http://localhost:10000/api/v1/files/${fileId}/link/pages/${pageId}`,
    {
      method: 'POST',
      credentials: 'include'
    }
  );

  return await response.json();
}
```

### Displaying Page Attachments

```typescript
async function getPageAttachments(pageId: number) {
  const response = await fetch(
    `http://localhost:10000/api/v1/files/linked/pages/${pageId}`,
    { credentials: 'include' }
  );

  const { data: files } = await response.json();

  return files.map(f => ({
    id: f.id,
    name: f.filename,
    size: formatBytes(f.size_bytes),
    url: `/api/v1/files/${f.id}/download`
  }));
}
```

---

## File Management Best Practices

### When to Use File Linking

**✅ Good use cases:**
- PDF documentation attached to pages
- Images embedded in page content
- User profile pictures
- Wiki logos or branding
- Downloadable resources

**❌ Avoid:**
- Tiny files that could be base64 encoded
- Files that change frequently (creates orphaned versions)
- Large video files (consider CDN/streaming instead)

### Managing File Permissions

**Strategy 1: Inherit from page**
```
File: No rules
Link to: Page with appropriate rules
Result: File inherits page's access control
```

**Strategy 2: File-level restrictions**
```
File: role=mobius_staff
Link to: Public page
Result: File only accessible to staff, even though page is public
```

**Strategy 3: Token-based file sharing**
```
File: link token with expiration
Link to: Private page
Result: File accessible with token, regardless of page rules
```

---

## Troubleshooting

### "I can see the page but can't download the attachment"

**Cause:** File has stricter ACL than page.

**Debug:**
```bash
# Check file ACL
curl -b cookies.txt http://localhost:10000/api/v1/files/81/access-rules

# Check page ACL
curl -b cookies.txt http://localhost:10000/api/v1/pages/34/access-rules
```

**Solution:** Either:
1. Remove file ACL (inherits from page)
2. Add matching rule to file
3. Grant user appropriate permissions

### "File upload returns 500 error"

**Possible causes:**
1. uploads/ directory doesn't exist
2. No write permissions on uploads/
3. File too large (if limits configured)

**Check:**
```bash
ls -ld backend/uploads/
# Should exist and be writable
```

### "File links not showing up"

**Check the link exists:**
```bash
curl http://localhost:10000/api/v1/files/linked/pages/34 | jq '.meta.total'
```

**Common issue:** Linking to wrong content type (used `page` instead of `pages`)

---

## Storage Migration (Future)

Current: Local disk storage
Future options:
- S3 / Object storage (for scalability)
- CDN (for performance)
- Image optimization service

The database schema supports migration - just change `storage_path` and update FilesService download logic.

---

## Related Documentation

- [ACL System](./03-acl-system.md) - File access control explained
- [Content Management](./04-content-management.md) - Pages to link files to
- [Examples](./10-examples.md) - Complete workflows
