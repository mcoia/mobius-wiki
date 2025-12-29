# Error Handling

## Overview

MOBIUS Wiki uses standard HTTP status codes and consistent error response formats across all endpoints.

---

## Error Response Format

All errors follow this structure:

```json
{
  "statusCode": 404,
  "message": "Page with ID 999 not found",
  "error": "Not Found"
}
```

**Fields:**
- `statusCode` - HTTP status code (number)
- `message` - Human-readable error description
- `error` - Error type (string)

---

## HTTP Status Codes

### 2xx Success

| Code | Name | When Used |
|------|------|-----------|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST (resource created) |

---

### 4xx Client Errors

| Code | Name | When Used | Example |
|------|------|-----------|---------|
| 400 | Bad Request | Invalid input, validation errors | Missing required field |
| 401 | Unauthorized | Not authenticated | No session cookie |
| 403 | Forbidden | Authenticated but not authorized | ACL denied access |
| 404 | Not Found | Resource doesn't exist | Page ID 999 not found |
| 409 | Conflict | Resource conflict | Slug already exists |

---

### 5xx Server Errors

| Code | Name | When Used |
|------|------|-----------|
| 500 | Internal Server Error | Unexpected server error |

---

## Common Error Scenarios

### 400 Bad Request

**Validation Errors:**

**Request:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "not-an-email"}'
```

**Response:**
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

**Common causes:**
- Missing required fields
- Invalid email format
- Invalid enum values (ruleType must be public/role/library/user/link)
- Type mismatches (expected number, got string)

---

### 401 Unauthorized

**Not Authenticated:**

**Request:**
```bash
curl -X POST http://localhost:10000/api/v1/wikis \
  -H "Content-Type: application/json" \
  -d '{"title": "New Wiki"}'
```

**Response:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Cause:** Endpoint requires authentication (AuthGuard) but no session cookie provided.

**Solution:** Login first and include cookies:
```bash
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -d '{"email": "admin@mobius.org", "password": "admin123"}'

curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis \
  -d '{"title": "New Wiki"}'
```

---

### 403 Forbidden

**ACL Denied:**

**Request:**
```bash
# Guest trying to access staff-only wiki
curl http://localhost:10000/api/v1/wikis/2
```

**Response:**
```json
{
  "statusCode": 403,
  "message": "Access denied",
  "error": "Forbidden"
}
```

**Causes:**
- User doesn't have required role
- User not in required library
- User not the specific user (for user rules)
- Token missing or invalid (for link rules)
- Token expired

**Debug steps:**
```bash
# Check what rules exist
curl -b cookies.txt http://localhost:10000/api/v1/wikis/2/access-rules

# Check current user
curl -b cookies.txt http://localhost:10000/api/v1/auth/me

# Try with admin account
curl -b admin_cookies.txt http://localhost:10000/api/v1/wikis/2
```

---

### 404 Not Found

**Resource Doesn't Exist:**

**Request:**
```bash
curl http://localhost:10000/api/v1/pages/999999
```

**Response:**
```json
{
  "statusCode": 404,
  "message": "Page with ID 999999 not found",
  "error": "Not Found"
}
```

**Common causes:**
- Resource doesn't exist
- Resource is soft-deleted (use `?includeDeleted=true` to verify)
- Wrong ID or slug
- Typo in URL

---

### 409 Conflict

**Duplicate Slug:**

**Request:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis \
  -H "Content-Type: application/json" \
  -d '{"title": "Folio", "slug": "folio"}'
```

**Response:**
```json
{
  "statusCode": 409,
  "message": "A wiki with slug 'folio' already exists",
  "error": "Conflict"
}
```

**Causes:**
- Wiki slug globally unique - duplicate detected
- Section slug unique per wiki - duplicate in same wiki
- Page slug unique per section - duplicate in same section

**Solution:** Use a different slug or update the existing resource.

---

## Error Handling in Frontend

### Detecting Error Types

```typescript
async function fetchWiki(id: number) {
  const response = await fetch(`http://localhost:10000/api/v1/wikis/${id}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();

    switch (error.statusCode) {
      case 401:
        // Redirect to login
        window.location.href = '/login';
        break;

      case 403:
        // Show "Access Denied" message
        alert('You do not have permission to view this wiki');
        break;

      case 404:
        // Show "Not Found" message
        alert('Wiki not found');
        break;

      case 409:
        // Show conflict error
        alert(error.message);
        break;

      default:
        // Generic error
        alert('An error occurred');
    }

    throw new Error(error.message);
  }

  return await response.json();
}
```

---

### Handling Validation Errors

```typescript
async function createWiki(data) {
  const response = await fetch('http://localhost:10000/api/v1/wikis', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (response.status === 400) {
    const error = await response.json();

    // error.message is array of validation errors
    if (Array.isArray(error.message)) {
      error.message.forEach(err => {
        console.error('Validation error:', err);
      });
    }

    throw new Error('Validation failed');
  }

  return await response.json();
}
```

---

## Debugging Errors

### Check Server Logs

```bash
# View recent logs
tail -f /tmp/backend.log

# Search for errors
grep -i error /tmp/backend.log
```

### Test with Verbose curl

```bash
curl -v http://localhost:10000/api/v1/pages/999
# Shows full HTTP headers and response
```

### Verify Authentication

```bash
# Check if logged in
curl -b cookies.txt http://localhost:10000/api/v1/auth/me

# If response is { "user": null }, you're not authenticated
```

### Check Database State

```bash
# Verify resource exists
docker exec <container> psql -U postgres -d mobius_wiki \
  -c "SELECT id, title, deleted_at FROM wiki.pages WHERE id = 42;"
```

---

## Common Error Patterns

### "401 on protected endpoint"

**Problem:** Forgot to include cookies.

**Wrong:**
```bash
curl -X POST http://localhost:10000/api/v1/wikis -d '...'
```

**Correct:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis -d '...'
```

---

### "403 after successful login"

**Problem:** User doesn't have required permissions.

**Check:** What are the user's role and library?
```bash
curl -b cookies.txt http://localhost:10000/api/v1/auth/me | jq '{role, libraryId}'
```

**Check:** What are the content's access rules?
```bash
curl -b cookies.txt http://localhost:10000/api/v1/pages/42/access-rules
```

---

### "409 Conflict on create"

**Problem:** Slug already exists.

**Solutions:**
1. Use a different slug
2. Let system auto-generate slug (omit slug field)
3. Update existing resource instead

---

### "500 Internal Server Error"

**Problem:** Server-side error (bug or database issue).

**Steps:**
1. Check server logs for stack trace
2. Verify database connection: `curl http://localhost:10000/api/v1/health`
3. Verify request format matches documentation
4. Report bug with request details

---

## Error Response Examples

### Validation Error (Array)

```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 12 characters"
  ],
  "error": "Bad Request"
}
```

### Single Error Message

```json
{
  "statusCode": 404,
  "message": "Wiki with ID 42 not found",
  "error": "Not Found"
}
```

### Generic Error

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Related Documentation

- [Authentication](./02-authentication.md) - 401/403 errors
- [ACL System](./03-acl-system.md) - 403 Forbidden errors
- [Content Management](./04-content-management.md) - 409 Conflict errors
