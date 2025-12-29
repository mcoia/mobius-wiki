# End-to-End Examples

Complete workflows demonstrating how to use the MOBIUS Wiki API for common tasks.

---

## Example 1: Creating a Complete Wiki

### Scenario

Create a new public wiki with sections and pages, then verify everything is searchable.

### Workflow

```bash
# Step 1: Login
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mobius.org",
    "password": "admin123"
  }'

# Response: {"data": {"id": 41, "name": "Site Administrator", ...}}

# Step 2: Create Wiki
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Library Policies",
    "description": "Official library policies and procedures"
  }' | jq '.id'

# Response: 31

# Step 3: Make Wiki Public
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/31/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "public"}'

# Response: Access rule created

# Step 4: Create Section
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/31/sections \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Circulation Policies",
    "description": "Borrowing and return policies",
    "sortOrder": 0
  }' | jq '.id'

# Response: 45

# Step 5: Create Page (Draft)
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/45/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Loan Periods",
    "content": "<h1>Loan Periods</h1><p>Books: 21 days, DVDs: 7 days, Magazines: 14 days</p>",
    "status": "draft"
  }' | jq '.id'

# Response: 200

# Step 6: Publish Page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/200/publish

# Response: {"id": 200, "status": "published", "publishedAt": "2025-01-15T15:00:00Z", ...}

# Step 7: Verify Guest Access (inherited from wiki)
curl http://localhost:10000/api/v1/pages/200 | jq '{id, title, status}'

# Response: {"id": 200, "title": "Loan Periods", "status": "published"}

# Step 8: Search for Content
curl "http://localhost:10000/api/v1/search?q=loan+periods" | jq '.data[] | {title, wiki: .wiki.title}'

# Response: [{"title": "Loan Periods", "wiki": "Library Policies"}]

# Step 9: Check Analytics
curl http://localhost:10000/api/v1/analytics/pages/200 | jq '{totalViews, uniqueSessions}'

# Response: {"totalViews": 1, "uniqueSessions": 1}
```

---

## Example 2: File Upload and Attachment

### Scenario

Upload a PDF document, attach it to a page, and verify download access.

### Workflow

```bash
# Step 1: Login
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mobius.org", "password": "admin123"}'

# Step 2: Upload File
curl -b cookies.txt -F "file=@user-manual.pdf" \
  -F "description=Complete user manual" \
  http://localhost:10000/api/v1/files | jq '.data.id'

# Response: 81

# Step 3: Link File to Page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/81/link/pages/1

# Response: Link created

# Step 4: Verify File is Linked
curl http://localhost:10000/api/v1/files/linked/pages/1 | jq '.data[] | {id, filename}'

# Response: [{"id": 81, "filename": "user-manual.pdf"}]

# Step 5: Download File (as guest)
curl -O "http://localhost:10000/api/v1/files/81/download"

# File downloaded: user-manual.pdf

# Step 6: Check File Metadata
curl http://localhost:10000/api/v1/files/81 | jq '{filename, mime_type, size_bytes}'

# Response: {"filename": "user-manual.pdf", "mime_type": "application/pdf", "size_bytes": 524288}
```

---

## Example 3: Creating Private Content with Link Sharing

### Scenario

Create a private page for staff only, then share it temporarily with an external partner.

### Workflow

```bash
# Step 1: Login
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "staff@mobius.org", "password": "admin123"}'

# Step 2: Create Page in Existing Section
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/1/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "2025 Budget Planning",
    "content": "<h1>Budget</h1><p>Confidential budget information...</p>",
    "status": "draft"
  }' | jq '.id'

# Response: 201

# Step 3: Add Staff-Only Rule
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/201/access-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleType": "role",
    "ruleValue": "mobius_staff"
  }'

# Response: Rule created

# Step 4: Verify Guest Cannot Access
curl http://localhost:10000/api/v1/pages/201

# Response: 403 Forbidden

# Step 5: Generate Temporary Share Link (30 days)
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/201/share-link \
  -H "Content-Type: application/json" \
  -d '{
    "expiresAt": "2025-02-15T00:00:00Z"
  }' | jq '.data.token'

# Response: "a1b2c3d4e5f6..."

# Step 6: Share URL with External Partner
# Send them: http://localhost:10000/api/v1/pages/201?token=a1b2c3d4e5f6...

# Step 7: Partner Accesses (No Login Required)
curl "http://localhost:10000/api/v1/pages/201?token=a1b2c3d4e5f6..." | jq '.title'

# Response: "2025 Budget Planning"

# Step 8: After 30 days, token expires
# curl with same token returns: 403 Forbidden
```

---

## Example 4: Content Discovery Workflow

### Scenario

User searches for content, views a page, and checks related analytics.

### Workflow

```bash
# Step 1: Search for "installation"
curl "http://localhost:10000/api/v1/search?q=installation&limit=5" \
  | jq '.data[] | {title, excerpt, wiki: .wiki.title}'

# Response: List of matching pages with excerpts

# Step 2: User Clicks on First Result (Page 3)
curl http://localhost:10000/api/v1/pages/3 | jq '{id, title, content}'

# Response: Full page data
# Note: This also tracks a page view automatically

# Step 3: Check Page Analytics
curl http://localhost:10000/api/v1/analytics/pages/3 | jq '{totalViews, uniqueSessions}'

# Response: {"totalViews": 15, "uniqueSessions": 12}

# Step 4: View Related Pages in Same Section
curl http://localhost:10000/api/v1/sections/17/pages | jq '.data[] | .title'

# Response: ["Page 10", "Page 11", "Page 12"]

# Step 5: Check What Files Are Attached
curl http://localhost:10000/api/v1/files/linked/pages/3 | jq '.data[] | {filename, size_bytes}'

# Response: List of attached files
```

---

## Example 5: Library-Specific Content

### Scenario

Create content that only Springfield Library staff can access.

### Workflow

```bash
# Step 1: Login as Admin
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mobius.org", "password": "admin123"}'

# Step 2: Create Page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/1/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Springfield Branch Procedures",
    "content": "<h1>Local Procedures</h1><p>Springfield-specific workflows...</p>"
  }' | jq '.id'

# Response: 202

# Step 3: Add Library-Specific Rule (Library ID = 1)
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/202/access-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleType": "library",
    "ruleValue": "1"
  }'

# Step 4: Test as Guest
curl http://localhost:10000/api/v1/pages/202
# Response: 403 Forbidden

# Step 5: Test as MOBIUS Staff (No Library)
curl -b staff_cookies.txt http://localhost:10000/api/v1/pages/202
# Response: 403 Forbidden (MOBIUS staff don't have library affiliation)

# Step 6: Test as Springfield Librarian (Library 1)
curl -c springfield_cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "librarian@springfield.org", "password": "admin123"}'

curl -b springfield_cookies.txt http://localhost:10000/api/v1/pages/202 | jq '.title'
# Response: "Springfield Branch Procedures" ✅
```

---

## Example 6: Multi-Level ACL

### Scenario

Create a wiki for staff, but make one specific section public for FAQs.

### Workflow

```bash
# Step 1: Create Staff-Only Wiki
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis \
  -H "Content-Type: application/json" \
  -d '{"title": "Internal Operations"}' | jq '.id'
# Response: 32

curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/32/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "role", "ruleValue": "mobius_staff"}'
# Wiki is now staff-only

# Step 2: Create Public FAQ Section
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/32/sections \
  -H "Content-Type: application/json" \
  -d '{"title": "Public FAQs"}' | jq '.id'
# Response: 46

curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/46/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "public"}'
# Section overrides wiki's staff-only rule

# Step 3: Create Page in Public FAQ Section
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/46/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "How to Reset Password",
    "content": "<h1>Password Reset</h1><p>Click forgot password...</p>",
    "status": "published"
  }' | jq '.id'
# Response: 203

# Step 4: Create Page in Staff-Only Section
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/1/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Admin Procedures",
    "content": "<h1>For Staff Only</h1>",
    "status": "published"
  }' | jq '.id'
# Response: 204

# Step 5: Test Guest Access
# Public FAQ page (inherits from section)
curl http://localhost:10000/api/v1/pages/203 | jq '.title'
# Response: "How to Reset Password" ✅

# Staff page (no public override)
curl http://localhost:10000/api/v1/pages/204
# Response: 403 Forbidden ❌ (inherits staff-only from wiki)
```

**Result:**
- Wiki 32: Staff-only
- Section 46: Public (overrides wiki)
- Page 203: Public (inherits from section)
- Page 204: Staff-only (inherits from wiki via parent section)

---

## Example 7: File Attachment Workflow

### Scenario

Upload a restricted file, attach to both public and private pages, test access.

### Workflow

```bash
# Step 1: Login
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mobius.org", "password": "admin123"}'

# Step 2: Upload File
curl -b cookies.txt -F "file=@policy-document.pdf" \
  http://localhost:10000/api/v1/files | jq '.data.id'
# Response: 85

# Step 3: Add Role Rule to File
curl -b cookies.txt -X POST http://localhost:10000/api/v1/files/85/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "role", "ruleValue": "library_staff"}'

# Step 4: Link to Public Page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/85/link/pages/34
# Page 34 is public

# Step 5: Link to Private Page
curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/85/link/pages/33
# Page 33 has link token

# Step 6: Test Guest Access
curl http://localhost:10000/api/v1/files/85
# Response: 403 Forbidden
# Why? File requires library_staff role (file ACL failed)

# Step 7: Test Library Staff Access
curl -b librarian_cookies.txt http://localhost:10000/api/v1/files/85 | jq '.filename'
# Response: "policy-document.pdf" ✅
# Why? Staff has library_staff role AND can access page 34 (public)

# Step 8: Remove Public Page Link
curl -b cookies.txt -X DELETE \
  http://localhost:10000/api/v1/files/85/link/pages/34

# Step 9: Test Library Staff Access Again
curl -b librarian_cookies.txt http://localhost:10000/api/v1/files/85
# Response: 403 Forbidden
# Why? File is now only linked to page 33 (link token required)

# Step 10: Test with Page 33 Token
curl -b librarian_cookies.txt \
  "http://localhost:10000/api/v1/files/85?token=35686b306c456da636dbab1ea7aeb99bcac9631e671fa0cd8af39e3a4502f2e3" \
  | jq '.filename'
# Response: "policy-document.pdf" ✅
```

---

## Example 8: Version History and Rollback

### Scenario

Create a page, make several edits, view version history.

### Workflow

```bash
# Step 1: Create Page
curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/1/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Configuration Guide",
    "content": "<h1>Config v1</h1><p>Initial content</p>",
    "status": "draft"
  }' | jq '.id'
# Response: 205
# Version 1 created automatically

# Step 2: Update Draft
curl -b cookies.txt -X PATCH http://localhost:10000/api/v1/pages/205 \
  -H "Content-Type: application/json" \
  -d '{"content": "<h1>Config v2</h1><p>Updated content</p>"}'
# Version 2 created

# Step 3: Publish
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/205/publish
# Version 3 created

# Step 4: Make Post-Publish Edit
curl -b cookies.txt -X PATCH http://localhost:10000/api/v1/pages/205 \
  -H "Content-Type: application/json" \
  -d '{"content": "<h1>Config v4</h1><p>Post-publish update</p>"}'
# Version 4 created

# Step 5: View Version History
curl http://localhost:10000/api/v1/pages/205/versions | jq '.meta.total'
# Response: 4

curl http://localhost:10000/api/v1/pages/205/versions \
  | jq '.data[] | {version: .versionNumber, title, createdAt}'

# Response:
# [
#   {"version": 4, "title": "Configuration Guide", "createdAt": "..."},
#   {"version": 3, "title": "Configuration Guide", "createdAt": "..."},
#   {"version": 2, "title": "Configuration Guide", "createdAt": "..."},
#   {"version": 1, "title": "Configuration Guide", "createdAt": "..."}
# ]

# Step 6: View Specific Version
curl http://localhost:10000/api/v1/pages/205/versions/1 \
  | jq '.content'

# Response: "<h1>Config v1</h1><p>Initial content</p>"

# Step 7: Compare Versions (Manual)
curl http://localhost:10000/api/v1/pages/205/versions/1 | jq -r '.content' > v1.html
curl http://localhost:10000/api/v1/pages/205/versions/4 | jq -r '.content' > v4.html
diff v1.html v4.html
```

---

## Example 9: Analytics Dashboard

### Scenario

Build an analytics dashboard showing popular pages and platform statistics.

### Workflow

```bash
# Step 1: Get Overall Platform Stats
curl http://localhost:10000/api/v1/analytics/stats | jq

# Response:
# {
#   "period": "all_time",
#   "views": {
#     "total": 202,
#     "pagesViewed": 33,
#     "uniqueUsers": 32,
#     "uniqueSessions": 102
#   },
#   "content": {
#     "wikis": 30,
#     "sections": 30,
#     "pages": 80,
#     "files": 82
#   }
# }

# Step 2: Get Top 10 Popular Pages (Last 7 Days)
curl "http://localhost:10000/api/v1/analytics/popular?limit=10&days=7" \
  | jq '.data[] | {title: .page.title, views: .viewCount}'

# Response:
# [
#   {"title": "Welcome to Folio", "views": 42},
#   {"title": "Getting Started", "views": 38},
#   ...
# ]

# Step 3: Get Specific Page Details
curl http://localhost:10000/api/v1/analytics/pages/1 | jq

# Response: Full stats with daily breakdown

# Step 4: Get View Log for Audit
curl "http://localhost:10000/api/v1/analytics/pages/1/views?limit=20" \
  | jq '.data[] | {viewedAt, user: .user.name}'

# Response:
# [
#   {"viewedAt": "2025-01-15T14:30:00Z", "user": "Site Administrator"},
#   {"viewedAt": "2025-01-15T12:00:00Z", "user": null}
# ]
```

---

## Example 10: Complete Content Management Cycle

### Scenario

Full lifecycle: create, update, share, search, analyze, delete.

### Workflow

```bash
# === SETUP ===
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mobius.org", "password": "admin123"}'

# === CREATE ===
# Create wiki
WIKI_ID=$(curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis \
  -H "Content-Type: application/json" \
  -d '{"title": "Testing Wiki"}' | jq -r '.id')
echo "Created wiki: $WIKI_ID"

# Make it public
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/$WIKI_ID/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "public"}'

# Create section
SECTION_ID=$(curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/$WIKI_ID/sections \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Section"}' | jq -r '.id')
echo "Created section: $SECTION_ID"

# Create page
PAGE_ID=$(curl -b cookies.txt -X POST http://localhost:10000/api/v1/sections/$SECTION_ID/pages \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Page",
    "content": "<h1>Test</h1><p>Testing full lifecycle</p>",
    "status": "draft"
  }' | jq -r '.id')
echo "Created page: $PAGE_ID"

# === UPDATE ===
curl -b cookies.txt -X PATCH http://localhost:10000/api/v1/pages/$PAGE_ID \
  -H "Content-Type: application/json" \
  -d '{"content": "<h1>Test</h1><p>Updated content with more details</p>"}'
echo "Updated page (version 2 created)"

# === PUBLISH ===
curl -b cookies.txt -X POST http://localhost:10000/api/v1/pages/$PAGE_ID/publish
echo "Published page"

# === UPLOAD ATTACHMENT ===
echo "Sample attachment content" > /tmp/sample.txt
FILE_ID=$(curl -b cookies.txt -F "file=@/tmp/sample.txt" \
  http://localhost:10000/api/v1/files | jq -r '.data.id')
echo "Uploaded file: $FILE_ID"

curl -b cookies.txt -X POST \
  http://localhost:10000/api/v1/files/$FILE_ID/link/pages/$PAGE_ID
echo "Linked file to page"

# === SEARCH ===
curl "http://localhost:10000/api/v1/search?q=lifecycle" \
  | jq '.data[] | select(.id == '$PAGE_ID') | .title'
echo "Found in search: Test Page"

# === ANALYTICS ===
curl http://localhost:10000/api/v1/pages/$PAGE_ID
curl http://localhost:10000/api/v1/analytics/pages/$PAGE_ID \
  | jq '{views: .totalViews, sessions: .uniqueSessions}'
echo "Analytics recorded"

# === DELETE ===
curl -b cookies.txt -X DELETE http://localhost:10000/api/v1/pages/$PAGE_ID
echo "Page soft-deleted"

# === VERIFY DELETION ===
curl http://localhost:10000/api/v1/pages/$PAGE_ID
# Response: 404 Not Found

curl "http://localhost:10000/api/v1/pages/$PAGE_ID?includeDeleted=true" \
  | jq '{id, deletedAt}'
# Response: Page exists with deletedAt timestamp
```

---

## Tips for API Integration

### Error Handling Pattern

```typescript
async function apiCall(url, options) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include'  // Always include cookies
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}
```

### Building URLs

```typescript
function buildSearchUrl(query, filters) {
  const params = new URLSearchParams({ q: query });

  if (filters.wikiId) params.append('wikiId', filters.wikiId);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);

  return `http://localhost:10000/api/v1/search?${params}`;
}
```

### Pagination Helper

```typescript
async function fetchAllPages(endpoint, pageSize = 20) {
  let offset = 0;
  let allData = [];
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${endpoint}?limit=${pageSize}&offset=${offset}`,
      { credentials: 'include' }
    );

    const { data, meta } = await response.json();
    allData = allData.concat(data);

    offset += pageSize;
    hasMore = data.length === pageSize;
  }

  return allData;
}
```

---

## Related Documentation

- [Authentication](./02-authentication.md) - Login workflow
- [Content Management](./04-content-management.md) - CRUD operations
- [ACL System](./03-acl-system.md) - Access control
- [File Management](./06-file-management.md) - File operations
- [Search](./07-search.md) - Search API
- [Analytics](./08-analytics.md) - Analytics API
