# Full-Text Search

## Overview

MOBIUS Wiki provides PostgreSQL Full-Text Search (FTS) with ACL filtering, relevance ranking, and rich metadata. Only content the user can access appears in search results.

---

## Search Endpoint

### GET /api/v1/search

Search across all pages.

**Authentication Required:** No (but results filtered by user's ACL permissions)

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query |
| `limit` | integer | No | 20 | Results per page (max: 100) |
| `offset` | integer | No | 0 | Pagination offset |
| `wikiId` | integer | No | - | Filter results to specific wiki |
| `sectionId` | integer | No | - | Filter results to specific section |

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 3,
      "title": "Page 10",
      "slug": "page-10",
      "status": "published",
      "excerpt": "This is test page 10 with search terms highlighted in context...",
      "section": {
        "id": 17,
        "title": "Section 17",
        "slug": "section-17"
      },
      "wiki": {
        "id": 25,
        "title": "Test Wiki 25",
        "slug": "test-wiki-25"
      },
      "rank": 0.30322516,
      "createdAt": "2025-01-10T08:00:00Z",
      "updatedAt": "2025-01-15T12:30:00Z"
    }
  ],
  "meta": {
    "total": 10,
    "limit": 20,
    "offset": 0,
    "query": "test page",
    "hasMore": false
  }
}
```

**curl Examples:**
```bash
# Basic search
curl "http://localhost:10000/api/v1/search?q=folio" | jq

# Multi-word search
curl "http://localhost:10000/api/v1/search?q=getting+started" | jq

# Search with pagination
curl "http://localhost:10000/api/v1/search?q=configuration&limit=10&offset=20" | jq

# Filter by wiki
curl "http://localhost:10000/api/v1/search?q=guide&wikiId=1" | jq

# Filter by section
curl "http://localhost:10000/api/v1/search?q=install&sectionId=5" | jq
```

---

## How Search Works

### PostgreSQL Full-Text Search

MOBIUS Wiki uses PostgreSQL's built-in FTS with:

**1. TSVECTOR Column:**
```sql
ALTER TABLE wiki.pages ADD COLUMN search_vector TSVECTOR;
```

**2. GIN Index:**
```sql
CREATE INDEX idx_pages_search_vector
  ON wiki.pages USING GIN(search_vector);
```

**3. Automatic Updates (Trigger):**
```sql
CREATE TRIGGER pages_search_vector_trigger
  BEFORE INSERT OR UPDATE ON wiki.pages
  FOR EACH ROW
  EXECUTE FUNCTION pages_search_vector_update();
```

**Trigger function:**
```sql
NEW.search_vector :=
  setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C');
```

**Weight meanings:**
- 'A' - Title (highest importance)
- 'C' - Content (lower importance)

### Query Processing

**Input:** `"getting started"`

**Processed to tsquery:**
```
getting & started
```

**SQL query:**
```sql
SELECT *,
  ts_rank(search_vector, to_tsquery('english', 'getting & started')) as rank
FROM wiki.pages
WHERE search_vector @@ to_tsquery('english', 'getting & started')
ORDER BY rank DESC;
```

**Features:**
- **Stemming**: "running" matches "run", "runs", "ran"
- **Stop words**: Ignores "the", "a", "an", "is", etc.
- **Case-insensitive**: "Folio" matches "folio"
- **Multi-word**: All words must appear (AND logic)

---

## ACL Filtering

### How Results Are Filtered

Search results respect the ACL system:

```typescript
async function search(query, user) {
  // Step 1: Run FTS query (pre-fetch 100 extra for filtering)
  const dbResults = await database.query(
    `SELECT ... FROM pages WHERE search_vector @@ to_tsquery(...)
     ORDER BY rank DESC LIMIT ${limit + 100}`
  );

  // Step 2: Filter by ACL
  const accessibleResults = [];
  for (const page of dbResults) {
    if (accessibleResults.length >= limit) break;

    // Check ACL
    if (await aclService.canAccess(user, 'page', page.id)) {
      // Check if link-shared only (not discoverable)
      if (!isLinkSharedOnly(page.id)) {
        accessibleResults.push(page);
      }
    }
  }

  return accessibleResults;
}
```

**Key points:**
- Pre-fetch extra results to account for ACL filtering
- Check ACL for each result
- Stop when we have enough accessible results
- Link-shared content excluded from search

### Guest vs Authenticated Results

**Same query, different results:**

```bash
# Guest search
curl "http://localhost:10000/api/v1/search?q=folio" | jq '.meta.total'
# Returns: 0 (no public pages match)

# Admin search
curl -b cookies.txt "http://localhost:10000/api/v1/search?q=folio" | jq '.meta.total'
# Returns: 1 (can access staff-only "Welcome to Folio" page)
```

---

## Link-Shared Content Exclusion

### The Privacy Rule

Pages with ONLY link-type rules are **not discoverable** via search:

```
Page 33 "Confidential Report"
Rules: [{ type: link, value: "abc123..." }]

Search for "confidential report":
  → Result: 0 matches (not discoverable)

Direct access with token:
  → GET /pages/33?token=abc123...
  → Result: ✅ 200 OK (access granted)
```

**Why:** Link-shared content should not be findable. Users must have the exact URL to access it.

### Mixed Rules Are Discoverable

```
Page 34 "Public Report"
Rules: [
  { type: public },
  { type: link, value: "xyz789..." }
]

Search for "public report":
  → Result: 1 match (IS discoverable because public rule exists)
```

---

## Relevance Ranking

### How Ranking Works

PostgreSQL `ts_rank()` scores results from 0.0 (not relevant) to 1.0 (highly relevant):

```sql
ts_rank(search_vector, to_tsquery('getting & started'))
```

**Factors affecting rank:**
- Title matches score higher (weight 'A')
- Content matches score lower (weight 'C')
- Multiple word matches score higher
- Proximity of terms (closer together = higher rank)

**Example results:**
```json
[
  {"title": "Getting Started Guide", "rank": 0.98},  // Perfect title match
  {"title": "Installation", "rank": 0.45},           // "getting started" in content
  {"title": "FAQ", "rank": 0.12}                     // Brief mention
]
```

Results are ordered by `rank DESC` (highest relevance first).

---

## Excerpt Generation

Each search result includes a 200-character excerpt with query context:

**Input:**
```
Query: "install"
Content: "<h1>Setup</h1><p>Before you begin, make sure to install the prerequisites. The installation process takes about 15 minutes...</p>"
```

**Output:**
```
"...Before you begin, make sure to install the prerequisites. The installation process takes about 15 minutes..."
```

**Algorithm:**
1. Strip HTML tags
2. Find first occurrence of query term
3. Extract 50 chars before + term + 150 chars after
4. Add ellipsis if truncated

---

## Metadata Enrichment

Search results include full wiki and section context:

```json
{
  "id": 42,
  "title": "Configuration Guide",
  "section": {
    "id": 5,
    "title": "Advanced Topics",
    "slug": "advanced-topics"
  },
  "wiki": {
    "id": 1,
    "title": "Folio",
    "slug": "folio"
  }
}
```

**Benefits:**
- Frontend can show breadcrumbs
- Users know where content is located
- Can filter by wiki/section client-side
- Single query (efficient JOIN, no N+1)

---

## Search Examples

### Basic Search

```bash
curl "http://localhost:10000/api/v1/search?q=welcome" | jq '.data[] | {title, rank}'
```

**Result:**
```json
[
  {"title": "Welcome to Folio", "rank": 0.8},
  {"title": "Getting Started", "rank": 0.3}
]
```

---

### Pagination

```bash
# Page 1 (first 20 results)
curl "http://localhost:10000/api/v1/search?q=guide&limit=20&offset=0"

# Page 2 (next 20 results)
curl "http://localhost:10000/api/v1/search?q=guide&limit=20&offset=20"

# Page 3 (next 20 results)
curl "http://localhost:10000/api/v1/search?q=guide&limit=20&offset=40"
```

---

### Filtering by Wiki

```bash
# Search only in Folio wiki (id=1)
curl "http://localhost:10000/api/v1/search?q=configuration&wikiId=1" | jq '.data[] | .wiki.title'

# All results will be from "Folio"
```

---

### Filtering by Section

```bash
# Search only in "Getting Started" section (id=1)
curl "http://localhost:10000/api/v1/search?q=install&sectionId=1"
```

---

## Frontend Integration

### Search Component

```typescript
async function searchContent(query: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  const response = await fetch(
    `http://localhost:10000/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`,
    { credentials: 'include' }
  );

  const { data, meta } = await response.json();

  return {
    results: data,
    total: meta.total,
    hasMore: meta.hasMore,
    page,
    totalPages: Math.ceil(meta.total / limit)
  };
}
```

### Displaying Results

```html
<!-- Search Results Template -->
<div class="search-results">
  <div *ngFor="let result of results">
    <h3>
      <a [href]="'/wiki/' + result.wiki.slug + '/' + result.section.slug + '/' + result.slug">
        {{ result.title }}
      </a>
    </h3>

    <p class="breadcrumb">
      {{ result.wiki.title }} > {{ result.section.title }}
    </p>

    <p class="excerpt">{{ result.excerpt }}</p>

    <p class="meta">
      <span>Relevance: {{ (result.rank * 100).toFixed(0) }}%</span>
      <span>Updated: {{ result.updatedAt | date }}</span>
    </p>
  </div>
</div>
```

---

## Search Performance

### Why It's Fast

1. **GIN Index:** `CREATE INDEX USING GIN(search_vector)`
   - Inverted index structure
   - O(log n) lookups
   - Handles millions of documents

2. **Pre-filtering:** Database does heavy lifting before ACL
   - SQL WHERE clause filters by FTS
   - Only check ACL for matching results
   - Stops when enough accessible results found

3. **Single Query:** JOINs pages + sections + wikis
   - No N+1 query problem
   - All metadata in one round trip

### Expected Performance

- **< 50ms** for queries with few matches
- **< 200ms** for broad queries (100+ matches)
- **< 500ms** worst case (ACL filtering large result set)

---

## Search Limitations

### What's Indexed

✅ **Indexed:**
- Page titles
- Page content (HTML)

❌ **Not Indexed:**
- Wiki titles
- Section titles
- File contents
- Tags (future enhancement)
- Comments (not in v1)

### Language Support

Currently: **English only**

```sql
to_tsvector('english', content)
```

For multi-language support, would need:
- Language detection
- Multiple tsvector columns OR
- Language-specific indexes

---

## Advanced Search (Future)

Planned enhancements:

1. **Tag filtering:** `?tags=tutorial,beginner`
2. **Date filtering:** `?updatedAfter=2025-01-01`
3. **Author filtering:** `?createdBy=41`
4. **Status filtering:** `?status=published`
5. **Phrase search:** `"exact phrase"` in quotes
6. **Wildcard search:** `conf*` matches configuration, config, configure
7. **Boolean operators:** `folio AND installation OR setup`

---

## Troubleshooting

### "Search returns no results but I know content exists"

**Possible causes:**

1. **ACL filtering** - User can't access matching pages
   ```bash
   # Test as admin
   curl -b admin_cookies.txt "http://localhost:10000/api/v1/search?q=yourquery"
   ```

2. **Link-shared only** - Page has only link rules (not discoverable)
   ```bash
   # Check page ACL
   curl -b cookies.txt http://localhost:10000/api/v1/pages/33/access-rules
   # If only link rules → not in search
   ```

3. **Soft-deleted** - Content is deleted
   ```bash
   curl "http://localhost:10000/api/v1/pages/42?includeDeleted=true"
   ```

4. **Search vector not updated** - Database trigger failed
   ```sql
   SELECT search_vector IS NOT NULL FROM wiki.pages WHERE id = 42;
   ```

### "Search is slow"

**Check:**
1. GIN index exists:
   ```sql
   \d wiki.pages
   -- Should see: idx_pages_search_vector GIN (search_vector)
   ```

2. Query plan:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM wiki.pages
   WHERE search_vector @@ to_tsquery('english', 'test');
   ```

3. Index being used:
   - Should see "Index Scan using idx_pages_search_vector"
   - Should NOT see "Seq Scan"

---

## Related Documentation

- [ACL System](./03-acl-system.md) - How search results are filtered
- [Content Management](./04-content-management.md) - Creating searchable pages
- [Examples](./10-examples.md) - Complete search workflows
