# Authentication

## Overview

MOBIUS Wiki uses **session-based authentication** (not JWT tokens). Sessions are stored in PostgreSQL for instant permission revocation and secure session management.

## Key Features

- Session storage in PostgreSQL (`wiki.sessions` table)
- Secure cookies (httpOnly, sameSite=lax)
- 24-hour session duration (default)
- 30-day session with "remember me"
- Bcrypt password hashing (12 rounds)
- Instant logout/revocation

---

## Endpoints

### POST /api/v1/auth/login

Log in with email and password.

**Authentication Required:** No

**Request Body:**
```json
{
  "email": "admin@mobius.org",
  "password": "admin123",
  "rememberMe": false
}
```

**Success Response (200 OK):**
```json
{
  "data": {
    "id": 41,
    "email": "admin@mobius.org",
    "name": "Site Administrator",
    "role": "site_admin",
    "libraryId": null,
    "isActive": true
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid email or password
- `400 Bad Request` - Missing required fields

**curl Example:**
```bash
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mobius.org",
    "password": "admin123",
    "rememberMe": false
  }'
```

**What happens:**
1. Server validates email/password against database
2. Creates session in `wiki.sessions` table
3. Returns session cookie (connect.sid)
4. Cookie is httpOnly (can't be accessed by JavaScript)
5. Cookie expires in 24 hours (or 30 days with rememberMe)

---

### POST /api/v1/auth/logout

Destroy the current session.

**Authentication Required:** Yes (AuthGuard)

**Request Body:** None

**Success Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

**curl Example:**
```bash
curl -b cookies.txt -X POST http://localhost:10000/api/v1/auth/logout
```

**What happens:**
1. Session is destroyed in database
2. Session cookie is cleared
3. User is immediately logged out
4. Subsequent requests fail with 401

---

### GET /api/v1/auth/me

Get current authenticated user information.

**Authentication Required:** No (returns null if not authenticated)

**Success Response (200 OK) - Authenticated:**
```json
{
  "user": {
    "id": 41,
    "email": "admin@mobius.org",
    "name": "Site Administrator",
    "role": "site_admin",
    "libraryId": null
  }
}
```

**Success Response (200 OK) - Not Authenticated:**
```json
{
  "user": null
}
```

**curl Example:**
```bash
curl -b cookies.txt http://localhost:10000/api/v1/auth/me
```

**Use case:** Frontend apps call this on page load to check if user is logged in.

---

## Session Management

### Session Configuration

```typescript
{
  store: PostgresStore,           // Stored in wiki.sessions table
  secret: SESSION_SECRET,          // From environment variable
  resave: false,                   // Don't save unchanged sessions
  saveUninitialized: false,        // Don't create sessions until needed
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours (or 30 days with rememberMe)
    httpOnly: true,                // Prevent JavaScript access (XSS protection)
    secure: true (in production),  // HTTPS only in production
    sameSite: 'lax'                // CSRF protection
  }
}
```

### Session Data Stored

When you log in, the session stores:
```typescript
{
  userId: 41,
  email: "admin@mobius.org",
  role: "site_admin",
  libraryId: null,
  name: "Site Administrator"
}
```

This data is used by:
- **AuthGuard** - Checks if `session.userId` exists
- **ACL System** - Checks user's role and libraryId
- **@User() decorator** - Injects user info into controllers

---

## Test Accounts

The seed data includes these test accounts:

| Email | Password | Role | Library | User ID |
|-------|----------|------|---------|---------|
| `admin@mobius.org` | `admin123` | site_admin | null | 41 |
| `staff@mobius.org` | `admin123` | mobius_staff | null | 42 |
| `librarian@springfield.org` | `admin123` | library_staff | 1 | 43 |

---

## Authentication Flow Example

### Complete Login Flow

```bash
# Step 1: Login
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mobius.org",
    "password": "admin123"
  }'

# Response includes user data
# cookies.txt now contains connect.sid session cookie

# Step 2: Access protected endpoint
curl -b cookies.txt http://localhost:10000/api/v1/wikis/2

# Step 3: Check current user
curl -b cookies.txt http://localhost:10000/api/v1/auth/me

# Step 4: Logout
curl -b cookies.txt -X POST http://localhost:10000/api/v1/auth/logout
```

---

## Security Considerations

### Password Requirements

Passwords must meet these criteria:
- Minimum 12 characters
- Maximum 128 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

**Validation happens server-side** in `validatePassword()` utility.

### Password Storage

Passwords are hashed with bcrypt (12 rounds):

```typescript
import * as bcrypt from 'bcrypt';

const hash = await bcrypt.hash(password, 12);
// Stored in database: $2b$12$...
```

**Never** stored in plain text. **Never** returned in API responses.

### Session Security

**httpOnly cookie:**
- JavaScript cannot read the cookie
- Prevents XSS attacks from stealing sessions

**sameSite=lax:**
- Cookie not sent on cross-site POST requests
- Prevents CSRF attacks

**secure flag (production):**
- Cookie only sent over HTTPS
- Prevents man-in-the-middle attacks

### Instant Revocation

Because sessions are stored in PostgreSQL:
- Deleting a session row immediately logs out the user
- Changing user permissions takes effect immediately
- No need to wait for JWT expiration

---

## Using Authentication in Your Frontend

### Login Flow

```typescript
// 1. Login
const response = await fetch('http://localhost:10000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // IMPORTANT: Include cookies
  body: JSON.stringify({
    email: 'admin@mobius.org',
    password: 'admin123'
  })
});

const { data } = await response.json();
console.log('Logged in as:', data.name);

// 2. Subsequent requests (cookie sent automatically)
const wikis = await fetch('http://localhost:10000/api/v1/wikis', {
  credentials: 'include'  // IMPORTANT: Include cookies
});
```

### Checking Authentication Status

```typescript
async function getCurrentUser() {
  const response = await fetch('http://localhost:10000/api/v1/auth/me', {
    credentials: 'include'
  });

  const { user } = await response.json();

  if (user) {
    console.log('Logged in as:', user.name);
    return user;
  } else {
    console.log('Not logged in');
    return null;
  }
}
```

### Logout Flow

```typescript
await fetch('http://localhost:10000/api/v1/auth/logout', {
  method: 'POST',
  credentials: 'include'
});

// Session destroyed, cookie cleared
```

---

## CORS Configuration

The backend is configured to accept requests from the frontend:

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true  // IMPORTANT: Allows cookies
});
```

**Frontend must:**
- Use `credentials: 'include'` on all fetch requests
- Run on the allowed origin (default: http://localhost:4200)

---

## Related Documentation

- [ACL System](./03-acl-system.md) - How access control works
- [Content Management](./04-content-management.md) - Creating wikis, sections, pages
- [Error Handling](./09-error-handling.md) - Authentication error codes
