# MOBIUS Wiki API Documentation

Complete API reference and guides for the MOBIUS Wiki backend.

---

## Quick Links

- **New to the API?** Start with [Getting Started](./01-getting-started.md)
- **Understanding Permissions?** Read [ACL System Guide](./03-acl-system.md) ⭐
- **Need API Reference?** See individual endpoint docs below
- **Want Examples?** Check [Complete Workflows](./10-examples.md)

---

## What is MOBIUS Wiki?

MOBIUS Wiki is a collaborative documentation platform and secure content delivery system for the MOBIUS Library Consortium. It features:

- **Flexible Access Control** - 5 rule types with inheritance
- **Full-Text Search** - PostgreSQL FTS with ACL filtering
- **Version History** - Complete audit trail for every page
- **File Management** - Upload and link files to content
- **Analytics** - Track page views and popular content
- **Session-Based Auth** - Secure, instant permission revocation

---

## Documentation Index

### Setup & Configuration

1. **[Getting Started](./01-getting-started.md)**
   - Prerequisites and installation
   - Environment configuration
   - Database setup
   - Running the server
   - Test accounts

### Core Concepts

2. **[Authentication](./02-authentication.md)**
   - Session-based authentication
   - Login/logout endpoints
   - Session management
   - Security features

3. **[ACL System](./03-acl-system.md)** ⭐ **START HERE FOR PERMISSIONS**
   - What is ACL?
   - The 5 rule types (public, role, library, user, link)
   - Inheritance logic explained
   - File access ("most restrictive wins")
   - Role hierarchy
   - Link sharing with tokens
   - Quick reference tables
   - Testing your ACL rules

### API Reference

4. **[Content Management](./04-content-management.md)**
   - Wikis API (6 endpoints)
   - Sections API (5 endpoints)
   - Pages API (8 endpoints)
   - CRUD operations
   - Soft delete behavior
   - Slug generation

5. **[Page Versioning](./05-page-versioning.md)**
   - How versioning works
   - Version history API
   - Retrieving specific versions
   - Full-snapshot storage

6. **[File Management](./06-file-management.md)**
   - File upload (multipart/form-data)
   - File download
   - Polymorphic linking (wikis/sections/pages/users)
   - File access control
   - Storage locations

7. **[Search](./07-search.md)**
   - Full-text search API
   - Query parameters
   - ACL filtering
   - Relevance ranking
   - Metadata enrichment
   - Link-shared content exclusion

8. **[Analytics](./08-analytics.md)**
   - Automatic page view tracking
   - Page statistics
   - Popular pages
   - Platform statistics
   - Time-based filtering
   - Daily aggregations

### Support

9. **[Error Handling](./09-error-handling.md)**
   - HTTP status codes
   - Error response format
   - Common error scenarios
   - Debugging tips

10. **[Complete Examples](./10-examples.md)**
    - End-to-end workflows
    - Creating a full wiki
    - File attachment workflow
    - Private content + link sharing
    - Analytics dashboard
    - Full lifecycle example

---

## Technology Stack

- **Framework:** NestJS 10.x with TypeScript
- **Database:** PostgreSQL 15+ with raw SQL (pg library)
- **Sessions:** PostgreSQL storage (connect-pg-simple)
- **File Upload:** Multer
- **Validation:** class-validator
- **Password:** bcrypt (12 rounds)
- **API Prefix:** `/api/v1`
- **Port:** 10000 (default)

---

## API Overview

### Endpoint Count

- **Authentication:** 3 endpoints
- **Wikis:** 6 endpoints
- **Sections:** 5 endpoints
- **Pages:** 8 endpoints
- **Files:** 8 endpoints
- **Access Rules:** 4 endpoints
- **Search:** 1 endpoint
- **Analytics:** 4 endpoints
- **Health:** 1 endpoint

**Total:** 50+ endpoints

### Base URL

```
http://localhost:10000/api/v1
```

### Authentication

Most write operations require authentication:
- Session-based (not JWT)
- Cookies automatically included in browser requests
- Use `-b cookies.txt` in curl commands

### Response Format

**Success (Single Resource):**
```json
{"data": {...}}
```

**Success (Collection):**
```json
{"data": [...], "meta": {"total": 42}}
```

**Error:**
```json
{"statusCode": 404, "message": "...", "error": "Not Found"}
```

---

## Quick Start Tutorial

### 1. Install and Start

```bash
cd mobius-wiki/backend
npm install
npm run db:setup
npm run start:dev
```

### 2. Login

```bash
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mobius.org", "password": "admin123"}'
```

### 3. Create Content

```bash
# Create wiki
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis \
  -H "Content-Type: application/json" \
  -d '{"title": "My Wiki"}'

# Make it public
curl -b cookies.txt -X POST http://localhost:10000/api/v1/wikis/31/access-rules \
  -H "Content-Type: application/json" \
  -d '{"ruleType": "public"}'
```

### 4. Search

```bash
curl "http://localhost:10000/api/v1/search?q=welcome" | jq
```

### 5. View Analytics

```bash
curl http://localhost:10000/api/v1/analytics/stats | jq
```

---

## Common Use Cases

### Frontend Integration

**Goal:** Build Angular/React app that consumes this API

**Start with:**
1. [Authentication](./02-authentication.md) - Login flow
2. [Content Management](./04-content-management.md) - Display wikis/pages
3. [Search](./07-search.md) - Search functionality

### API-Only Usage

**Goal:** Programmatic access for scripts/integrations

**Start with:**
1. [Authentication](./02-authentication.md) - Get session cookie
2. [Examples](./10-examples.md) - Copy-paste workflows

### Understanding Permissions

**Goal:** Configure who can see what

**Read:** [ACL System Guide](./03-acl-system.md) - Complete permission system explained

---

## FAQ

**Q: Is this a REST API?**
A: Yes, follows REST principles with standard HTTP methods (GET, POST, PATCH, DELETE).

**Q: Does it use JWT tokens?**
A: No, uses session-based authentication with PostgreSQL storage for instant revocation.

**Q: Can I use this with any frontend?**
A: Yes, it's framework-agnostic. CORS is configured for frontend on port 4200.

**Q: Is there rate limiting?**
A: Not yet implemented (future enhancement for auth endpoints).

**Q: Where are files stored?**
A: Locally in `backend/uploads/` directory (can migrate to S3/CDN for production).

**Q: How does search work?**
A: PostgreSQL Full-Text Search with tsvector + GIN index, filtered by ACL.

**Q: Can I see analytics for private pages?**
A: Yes, analytics endpoints are public (only track views, don't expose content).

**Q: How do I contribute?**
A: See project CLAUDE.md for development guidelines and standards.

---

## Support

**Issues:** Report bugs at <repository-issues-url>

**Questions:** <contact-information>

**Documentation Updates:** Submit PRs to improve these docs

---

## What's Next?

After reading this documentation:

1. **Setup** - Follow [Getting Started](./01-getting-started.md)
2. **Understand ACL** - Read [ACL Guide](./03-acl-system.md)
3. **Try Examples** - Run workflows from [Examples](./10-examples.md)
4. **Build UI** - Create frontend app using this API
5. **Deploy** - Setup production environment

---

## Documentation Version

**Last Updated:** December 19, 2025
**API Version:** v1
**Backend Version:** 1.0.0

---

## Table of Contents

1. [Getting Started](./01-getting-started.md) - Setup and configuration
2. [Authentication](./02-authentication.md) - Session management
3. [ACL System](./03-acl-system.md) - Access control explained ⭐
4. [Content Management](./04-content-management.md) - Wikis, sections, pages
5. [Page Versioning](./05-page-versioning.md) - Version history
6. [File Management](./06-file-management.md) - Upload and linking
7. [Search](./07-search.md) - Full-text search
8. [Analytics](./08-analytics.md) - Page views and stats
9. [Error Handling](./09-error-handling.md) - Status codes and errors
10. [Examples](./10-examples.md) - Complete workflows
