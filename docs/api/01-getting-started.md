# Getting Started

## Prerequisites

Before setting up the MOBIUS Wiki backend, ensure you have:

- **Node.js 20.x LTS** or later
- **npm 10.x** or later
- **PostgreSQL 15.x** or later
- **Git** for version control

---

## Quick Start

### 1. Clone the Repository

```bash
cd /path/to/your/projects
git clone <repository-url>
cd mobius-wiki/backend
```

### 2. Install Dependencies

```bash
npm install
```

Expected packages:
- @nestjs/core, @nestjs/common, @nestjs/platform-express
- pg (PostgreSQL driver)
- express-session, connect-pg-simple
- bcrypt, class-validator, class-transformer
- multer (file uploads)

### 3. Configure Environment

Create a `.env` file in the `backend/` directory:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=mobius_wiki
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password_here
DATABASE_URL=postgresql://postgres:your_password_here@localhost:5432/mobius_wiki

# Session Secret (generate a secure random string)
SESSION_SECRET=your_secure_random_string_min_32_characters_long

# Application
NODE_ENV=development
PORT=10000

# Frontend (for CORS)
FRONTEND_URL=http://localhost:4200
```

**Generating SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Setup Database

**All-in-one command:**
```bash
npm run db:setup
```

This runs:
1. `npm run db:create` - Creates mobius_wiki database
2. `npm run migrate` - Runs schema migration (14 tables)
3. `npm run db:seed` - Inserts sample data

**Or run step-by-step:**
```bash
npm run db:create           # Create database
npm run migrate             # Apply schema
npm run db:seed             # Load sample data
npm run test:connection     # Verify connection
```

### 5. Start the Server

**Development mode (with auto-reload):**
```bash
npm run start:dev
```

**Production mode:**
```bash
npm run build
npm run start:prod
```

Server starts on `http://localhost:10000`

### 6. Verify Installation

**Health check:**
```bash
curl http://localhost:10000/api/v1/health | jq
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "database": "connected",
  "dbTime": "2025-01-15T10:00:00.000Z"
}
```

**Test login:**
```bash
curl -c cookies.txt -X POST http://localhost:10000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mobius.org",
    "password": "admin123"
  }' | jq '.data.name'
```

**Expected response:**
```
"Site Administrator"
```

---

## Sample Data

After running `npm run db:seed`, you'll have:

### Test Accounts

| Email | Password | Role | Library |
|-------|----------|------|---------|
| admin@mobius.org | admin123 | site_admin | null |
| staff@mobius.org | admin123 | mobius_staff | null |
| librarian@springfield.org | admin123 | library_staff | Springfield (ID: 1) |

### Test Content

- **2 Wikis:** Folio (public), OpenRS (staff-only)
- **3 Sections:** Getting Started, Advanced Topics
- **2 Pages:** "Welcome to Folio", "System Requirements"
- **4 Tags:** tutorial, beginner, advanced, reference
- **Access Rules:** Demonstrating public and role-based access
- **~1000 test records** for battle-testing

---

## Database Management

### View Migration Status

```bash
npm run migrate:status
```

Shows which migrations have been applied.

### Rollback Last Migration

```bash
npm run migrate:rollback
```

⚠️ **Warning:** This deletes all data in the affected tables.

### Reset Database

```bash
# Drop database
psql -U postgres -c "DROP DATABASE IF EXISTS mobius_wiki;"

# Recreate from scratch
npm run db:setup
```

---

## Available npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run build` | `nest build` | Compile TypeScript to JavaScript |
| `npm start` | `nest start` | Start production server |
| `npm run start:dev` | `nest start --watch` | Start with auto-reload |
| `npm run start:debug` | `nest start --debug --watch` | Start with debugging |
| `npm run db:create` | Create database | Creates mobius_wiki database |
| `npm run migrate` | Run migrations | Applies schema changes |
| `npm run db:seed` | Insert seed data | Loads sample content |
| `npm run db:setup` | All-in-one | Create + migrate + seed |
| `npm run test:connection` | Test DB connection | Verifies database connectivity |

---

## Docker Setup (Alternative)

If you prefer running PostgreSQL in Docker:

```bash
# Start PostgreSQL container
docker run -d \
  --name mobius-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=mobius_wiki \
  -p 5432:5432 \
  postgres:15

# Update .env
DATABASE_HOST=localhost
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Continue with npm run migrate, etc.
```

---

## Project Structure

```
backend/
├── src/                        # Source code
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── auth/                   # Authentication
│   ├── access-control/         # ACL system
│   ├── access-rules/           # ACL management API
│   ├── wikis/                  # Wiki CRUD
│   ├── sections/               # Section CRUD
│   ├── pages/                  # Page CRUD + versioning
│   ├── files/                  # File upload/linking
│   ├── search/                 # Full-text search
│   ├── analytics/              # Page view tracking
│   ├── health/                 # Health check
│   ├── common/                 # Utilities, decorators
│   └── database/               # DB connection pool
├── migrations/                 # SQL schema files
├── seeds/                      # Sample data
├── scripts/                    # Database scripts
├── uploads/                    # File storage (created automatically)
├── .env                        # Environment config
├── package.json                # Dependencies
└── tsconfig.json               # TypeScript config
```

---

## Development Workflow

### Making Code Changes

```bash
# Server auto-reloads in dev mode
npm run start:dev

# Make changes to src/ files
# Server automatically restarts
```

### Adding a New Migration

```bash
# Create migration file
touch migrations/002_add_feature.sql

# Write SQL
echo "ALTER TABLE wiki.pages ADD COLUMN new_field VARCHAR(100);" > migrations/002_add_feature.sql

# Run migration
npm run migrate
```

### Testing API Endpoints

Use the examples in this documentation with curl, or:

1. **Postman** - Import endpoints and test interactively
2. **REST Client (VSCode)** - Create .http files
3. **curl** - Command-line testing

---

## Troubleshooting

### "Database connection failed"

**Check PostgreSQL is running:**
```bash
psql -U postgres -c "SELECT version();"
```

**Verify .env settings:**
```bash
cat .env | grep DATABASE
```

**Test connection script:**
```bash
npm run test:connection
```

---

### "Port 10000 already in use"

**Find process:**
```bash
lsof -i :10000
```

**Kill process:**
```bash
kill -9 <PID>
```

**Or use different port:**
```bash
PORT=10001 npm run start:dev
```

---

### "Migration failed"

**Check migration status:**
```bash
npm run migrate:status
```

**Rollback and retry:**
```bash
npm run migrate:rollback
npm run migrate
```

---

### "Session not persisting"

**Check session table exists:**
```bash
psql -U postgres -d mobius_wiki -c "\d wiki.sessions"
```

**Check SESSION_SECRET is set:**
```bash
echo $SESSION_SECRET
```

**Verify cookies in response:**
```bash
curl -v -X POST http://localhost:10000/api/v1/auth/login \
  -d '{"email": "admin@mobius.org", "password": "admin123"}' \
  2>&1 | grep -i "set-cookie"
```

---

## Next Steps

Now that your backend is running:

1. **Explore the API** - Use curl examples from documentation
2. **Understand ACL** - Read [ACL System Guide](./03-acl-system.md)
3. **Test endpoints** - Try [Examples](./10-examples.md) workflows
4. **Build frontend** - Connect Angular/React app to API

---

## Related Documentation

- [API Documentation Index](./README.md)
- [Authentication](./02-authentication.md)
- [Content Management](./04-content-management.md)
- [Examples](./10-examples.md)
