# MOBIUS Wiki - Database Schema

Complete PostgreSQL database schema for the MOBIUS Wiki platform with 14 tables and migration tracking. All tables are organized within the `wiki` schema for better namespace isolation.

## ✅ What's Been Implemented

### Migration Strategy

**Raw SQL Files with State Tracking:**
- ✅ `000_migration_tracking.sql` - Creates `wiki` schema and `wiki.schema_migrations` tracking table
- ✅ `001_schema.sql` - Complete initial schema (all 14 tables in `wiki` schema)
- ✅ Migration runner automatically detects and runs pending migrations
- ✅ Rollback capability for last migration
- ✅ Status tracking shows applied/pending migrations

**Future Migrations:**
Add new migrations as `002_add_column.sql`, `003_new_table.sql`, etc.
The migration system will automatically detect and run them in order.

### Project Structure
```
backend/
├── package.json
├── .env.example
├── .env (gitignored)
├── migrations/
│   ├── 000_migration_tracking.sql  # Migration tracking table
│   └── 001_schema.sql              # Initial schema (all 14 tables)
├── seeds/
│   └── 001_initial_data.sql        # Sample data
└── scripts/
    ├── create-db.sh                # Database creation
    ├── run-migrations.sh           # Migration runner with tracking
    ├── migration-status.sh         # Show migration status
    ├── rollback-migration.sh       # Rollback last migration
    └── test-connection.js          # Connection test
```

### Database Tables (14 Total)

**Core Hierarchy (5 tables)**
1. `libraries` - Member library organizations
2. `users` - User accounts with roles (library_staff, mobius_staff, site_admin)
3. `wikis` - Top-level wiki containers
4. `sections` - Organizational groupings within wikis
5. `pages` - Actual content with full-text search (TSVECTOR + GIN index)

**Versioning & Tags (4 tables)**
6. `page_versions` - Full-snapshot version history (permanent)
7. `tags` - Content tags
8. `page_tags` - Page-to-tag many-to-many junction
9. `files` - First-class file entities

**Linking & Access (2 tables)**
10. `file_links` - Polymorphic file linking (wiki/section/page/user)
11. `access_rules` - Polymorphic ACL with 5 rule types

**Analytics & Routing (3 tables)**
12. `page_views` - Page view tracking
13. `redirects` - 301 redirects for slug changes
14. `sessions` - PostgreSQL session storage

### Schema Organization

All tables are organized within the `wiki` schema for better namespace isolation:
```sql
-- All tables live in the wiki schema
wiki.libraries
wiki.users
wiki.wikis
wiki.pages
wiki.schema_migrations
-- etc.
```

**Benefits:**
- Namespace isolation from other applications
- Cleaner organization
- Easier backup/restore of just wiki tables
- Prevents naming conflicts with other schemas

**Usage:**
```sql
-- Query tables with schema prefix
SELECT * FROM wiki.pages WHERE status = 'published';

-- Insert data
INSERT INTO wiki.wikis (title, slug) VALUES ('My Wiki', 'my-wiki');
```

## 🚀 Getting Started

### Prerequisites

- **PostgreSQL 15+** installed and running
- **Node.js 20.x** LTS
- **npm 10.x** or later

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment

Copy `.env.example` to `.env` and update with your PostgreSQL credentials:

```bash
cp .env.example .env
nano .env
```

### Step 3: Setup Database

```bash
# All-in-one: create DB, run migrations, seed data
npm run db:setup

# Or step by step:
npm run db:create        # Create mobius_wiki database
npm run migrate          # Run pending migrations (tracks state)
npm run db:seed          # Insert sample data
npm run test:connection  # Verify connection and list tables
```

### Step 4: Verify Setup

```bash
npm run migrate:status
```

Expected output:
```
Applied migrations:
 migration_name         | applied_at
------------------------+----------------------------
 000_migration_tracking.sql | 2024-12-16 16:00:00
 001_schema.sql         | 2024-12-16 16:00:01

Pending migrations:
  (none - all migrations applied)
```

## 📋 Available NPM Scripts

```bash
# Database Management
npm run db:create         # Create database
npm run db:seed           # Insert sample data
npm run db:setup          # Create + migrate + seed (all-in-one)

# Migrations
npm run migrate           # Run pending migrations (tracks state)
npm run migrate:status    # Show applied/pending migrations
npm run migrate:rollback  # Rollback last migration

# Testing
npm run test:connection   # Test database connection
```

## 🔄 Migration System

### How It Works

1. **Migration Tracking Table:**
   - `000_migration_tracking.sql` creates `schema_migrations` table
   - Tracks which migrations have been applied and when

2. **Running Migrations:**
   - `npm run migrate` checks `schema_migrations` for applied migrations
   - Runs only pending migrations in alphabetical order
   - Records each migration after successful execution

3. **Adding New Migrations:**
   ```bash
   # Create new migration file
   echo "ALTER TABLE pages ADD COLUMN new_field VARCHAR(255);" > migrations/002_add_new_field.sql

   # Run it
   npm run migrate
   ```

4. **Rollback:**
   ```bash
   # Rolls back the last applied migration
   npm run migrate:rollback

   # Note: Requires manual rollback SQL or will warn you
   ```

### Migration File Naming

- `000_migration_tracking.sql` - Special: migration tracking table
- `001_schema.sql` - Initial schema
- `002_add_column.sql` - Future migration example
- `003_create_index.sql` - Future migration example

**Format:** `###_description.sql` where `###` is a 3-digit number.

## 🔍 Key Features Implemented

### 1. Migration Tracking

```sql
-- wiki.schema_migrations table
CREATE TABLE wiki.schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 2. Full-Text Search

- `wiki.pages.search_vector` (TSVECTOR) with GIN index
- Auto-updates via trigger on INSERT/UPDATE
- Searches title + content in English

Example query:
```sql
SELECT * FROM wiki.pages
WHERE search_vector @@ plainto_tsquery('english', 'folio')
  AND deleted_at IS NULL
ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'folio')) DESC;
```

### 3. Soft Deletes (6 tables)

Tables with soft delete support:
- `wiki.libraries`, `wiki.users`, `wiki.wikis`, `wiki.sections`, `wiki.pages`, `wiki.files`
- Fields: `deleted_at`, `deleted_by`
- Query pattern: `WHERE deleted_at IS NULL`

### 4. Polymorphic Relationships (2 tables)

**file_links** - Files can link to any content type
```sql
linkable_type = 'page'
linkable_id = 42
```

**access_rules** - ACL rules for any content type
```sql
ruleable_type = 'wiki'
ruleable_id = 1
rule_type = 'public'
```

### 5. Access Control Rules

Five rule types supported:
- `public` - Anyone can access
- `link` - Access via share token (with optional expiration)
- `role` - Role-based (library_staff, mobius_staff, site_admin)
- `library` - Specific library access
- `user` - Individual user access

**ACL Inheritance**: Page → Section → Wiki → Default (public)

## 🧪 Sample Data

The seed file creates:
- 2 libraries (MOBIUS HQ, Springfield)
- 3 users (all with password: `admin123`)
  - `admin@mobius.org` - Site Admin
  - `staff@mobius.org` - MOBIUS Staff
  - `librarian@springfield.org` - Library Staff
- 2 wikis (Folio public, OpenRS staff-only)
- 3 sections
- 2 published pages with version history
- 4 tags
- Access rules

## 📚 Next Steps

After database setup, proceed with:

1. **NestJS Backend Setup** - Initialize NestJS app
2. **Database Service** - Create PostgreSQL Pool provider
3. **Access Control Service** - Implement ACL inheritance logic
4. **CRUD Services** - Wiki, Section, Page services with raw SQL
5. **Authentication** - Session-based auth with connect-pg-simple
6. **API Controllers** - RESTful endpoints for all entities

## 📖 Reference Documentation

- **Technical Spec**: `/docs/mobius-wiki-tech-spec.md` - Complete schemas, constraints, business rules
- **Edge Cases**: `/docs/edge-case-questions.md` - Design decisions
- **Project Guidelines**: `/CLAUDE.md` - Development standards

---

**Database schema with migration tracking implemented! 🎉**

All 14 tables, migration tracking, rollback capability, and sample data ready for backend integration.
