# Analytics & Page Views

## Overview

MOBIUS Wiki automatically tracks page views and provides analytics endpoints for understanding content usage. Tracking is non-blocking and transparent to users.

---

## Automatic Page View Tracking

### When Views Are Tracked

Page views are automatically recorded when:

- ✅ HTTP Method is GET
- ✅ Endpoint is `/api/v1/pages/:id`
- ✅ Response status is 200 (successful access)
- ✅ ACL check passed

**Not tracked:**
- Page lists (GET /sections/:id/pages)
- Version history views
- Failed access attempts (403)
- POST/PATCH/DELETE operations

### What's Tracked

Each page view records:

| Field | Description | Source |
|-------|-------------|--------|
| `page_id` | Page being viewed | URL parameter |
| `user_id` | Authenticated user (or null) | Session |
| `session_id` | Browser session ID | Express session |
| `referrer` | Previous page URL | HTTP Referer header |
| `viewed_at` | Timestamp | NOW() |

**Example record:**
```json
{
  "id": 203,
  "page_id": 3,
  "user_id": 41,
  "session_id": "abc123...",
  "referrer": "http://localhost:10000/search?q=test",
  "viewed_at": "2025-12-19T23:32:53.200Z"
}
```

---

## Analytics Endpoints

### GET /api/v1/analytics/pages/:id

Get statistics for a specific page.

**Authentication Required:** No

**Path Parameters:**
- `id` - Page ID

**Query Parameters:**
- `days` (optional) - Filter to last N days (1-365)

**Success Response (200 OK):**
```json
{
  "pageId": 3,
  "period": "all_time",
  "totalViews": 202,
  "uniqueUsers": 32,
  "uniqueSessions": 102,
  "lastViewedAt": "2025-12-19T23:32:53.200Z",
  "firstViewedAt": "2025-12-15T10:00:00Z",
  "dailyViews": [
    {
      "date": "2025-12-19",
      "views": 15,
      "uniqueSessions": 8
    },
    {
      "date": "2025-12-18",
      "views": 42,
      "uniqueSessions": 18
    }
  ]
}
```

**curl Examples:**
```bash
# All-time stats
curl http://localhost:10000/api/v1/analytics/pages/3 | jq

# Last 7 days
curl "http://localhost:10000/api/v1/analytics/pages/3?days=7" | jq

# Last 30 days
curl "http://localhost:10000/api/v1/analytics/pages/3?days=30" | jq
```

---

### GET /api/v1/analytics/pages/:id/views

Get detailed view log with individual view records.

**Authentication Required:** No

**Path Parameters:**
- `id` - Page ID

**Query Parameters:**
- `limit` (optional) - Records per page (default: 100, max: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": 203,
      "viewedAt": "2025-12-19T23:32:53.200Z",
      "sessionId": "abc123def456...",
      "referrer": "http://localhost:10000/api/v1/search?q=test",
      "user": {
        "id": 41,
        "name": "Site Administrator",
        "email": "admin@mobius.org"
      }
    },
    {
      "id": 202,
      "viewedAt": "2025-12-19T22:15:00.000Z",
      "sessionId": "xyz789abc123...",
      "referrer": null,
      "user": null
    }
  ],
  "meta": {
    "total": 202,
    "limit": 100,
    "offset": 0
  }
}
```

**curl Example:**
```bash
curl "http://localhost:10000/api/v1/analytics/pages/3/views?limit=50" | jq
```

**Use case:** Detailed audit trail showing who viewed content and when.

---

### GET /api/v1/analytics/popular

Get most popular pages ranked by view count.

**Authentication Required:** No

**Query Parameters:**
- `limit` (optional) - Number of pages (default: 10, max: 100)
- `days` (optional) - Filter to last N days

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "page": {
        "id": 18,
        "title": "Page 18",
        "slug": "page-18"
      },
      "section": {
        "title": "Section 1",
        "slug": "section-1"
      },
      "wiki": {
        "title": "Test Wiki 20",
        "slug": "test-wiki-20"
      },
      "viewCount": 8,
      "uniqueSessions": 5
    }
  ],
  "meta": {
    "limit": 10,
    "period": "all_time"
  }
}
```

**curl Examples:**
```bash
# Top 10 all-time
curl http://localhost:10000/api/v1/analytics/popular | jq

# Top 20 last 7 days
curl "http://localhost:10000/api/v1/analytics/popular?limit=20&days=7" | jq
```

**Use case:** Homepage "Trending Documentation" widget.

---

### GET /api/v1/analytics/stats

Get overall platform statistics.

**Authentication Required:** No

**Query Parameters:**
- `days` (optional) - Filter to last N days

**Success Response (200 OK):**
```json
{
  "period": "all_time",
  "views": {
    "total": 202,
    "pagesViewed": 33,
    "uniqueUsers": 32,
    "uniqueSessions": 102
  },
  "content": {
    "wikis": 30,
    "sections": 30,
    "pages": 80,
    "files": 82
  }
}
```

**curl Examples:**
```bash
# All-time platform stats
curl http://localhost:10000/api/v1/analytics/stats | jq

# Last 30 days
curl "http://localhost:10000/api/v1/analytics/stats?days=30" | jq
```

**Use case:** Admin dashboard showing platform health.

---

## Time-Based Filtering

All analytics endpoints support the `?days` parameter:

```bash
# Last 7 days
?days=7

# Last 30 days
?days=30

# Last year
?days=365

# All-time (default)
(no days parameter)
```

**SQL implementation:**
```sql
WHERE viewed_at >= NOW() - INTERVAL '7 days'
```

---

## Unique Visitor Tracking

### Sessions vs Users

The system tracks both:

**Unique Users:**
- COUNT(DISTINCT user_id)
- Authenticated users only
- Persistent across browser sessions

**Unique Sessions:**
- COUNT(DISTINCT session_id)
- Includes guests + authenticated users
- One per browser session
- More accurate for total visitor count

**Example:**
```
Page viewed by:
  - Guest (3 different sessions) = 3 unique sessions, 0 unique users
  - User 41 (2 different sessions) = 2 unique sessions, 1 unique user

Total: 5 unique sessions, 1 unique user
```

---

## Daily Aggregations

The `dailyViews` array shows day-by-day breakdown:

```json
"dailyViews": [
  {"date": "2025-12-19", "views": 15, "uniqueSessions": 8},
  {"date": "2025-12-18", "views": 42, "uniqueSessions": 18},
  {"date": "2025-12-17", "views": 28, "uniqueSessions": 12}
]
```

**Use case:** Charts showing view trends over time.

**Limit:** Returns last 30 days maximum.

---

## Frontend Integration

### Analytics Dashboard Component

```typescript
async function getPageAnalytics(pageId: number, days?: number) {
  const url = days
    ? `http://localhost:10000/api/v1/analytics/pages/${pageId}?days=${days}`
    : `http://localhost:10000/api/v1/analytics/pages/${pageId}`;

  const response = await fetch(url, { credentials: 'include' });
  return await response.json();
}

// Usage
const stats = await getPageAnalytics(3, 7);  // Last 7 days
console.log(`Total views: ${stats.totalViews}`);
console.log(`Unique visitors: ${stats.uniqueSessions}`);
```

### Popular Pages Widget

```typescript
async function getPopularPages(limit: number = 5, days?: number) {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (days) params.append('days', days.toString());

  const response = await fetch(
    `http://localhost:10000/api/v1/analytics/popular?${params}`,
    { credentials: 'include' }
  );

  const { data } = await response.json();
  return data;
}

// Display
const popular = await getPopularPages(5, 7);
popular.forEach(p => {
  console.log(`${p.page.title}: ${p.viewCount} views`);
});
```

---

## Privacy Considerations

### What's Tracked

✅ **Tracked:**
- Page views (successful 200 responses)
- Authenticated user IDs
- Session IDs (anonymous tracking)
- Referrer URLs (where users came from)
- Timestamps

❌ **NOT Tracked:**
- IP addresses (not stored)
- User agents (not stored)
- Failed access attempts
- Search queries
- File downloads

### User Privacy

- Guest views are anonymous (user_id = null)
- Session IDs are opaque (can't identify individuals)
- No cross-device tracking
- No external analytics services

---

## Database Schema

### page_views Table

```sql
CREATE TABLE wiki.page_views (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES wiki.pages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES wiki.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  session_id VARCHAR(255),
  referrer VARCHAR(500)
);

CREATE INDEX idx_page_views_page_id ON wiki.page_views(page_id);
CREATE INDEX idx_page_views_user_id ON wiki.page_views(user_id);
CREATE INDEX idx_page_views_viewed_at ON wiki.page_views(viewed_at);
```

**Indexes support:**
- Fast lookups by page
- Fast user activity queries
- Efficient date range filtering

---

## Related Documentation

- [Content Management](./04-content-management.md) - Pages that are tracked
- [ACL System](./03-acl-system.md) - Only successful access is tracked
- [Examples](./10-examples.md) - Analytics workflows
