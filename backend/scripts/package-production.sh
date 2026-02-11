#!/bin/bash
#
# package-production.sh
#
# Creates a production data package containing all files needed for a clean
# database initialization on a production server.
#
# Output: production-data.tar.gz
#
# Contents:
#   - seeds/*.sql (all SQL seed files)
#   - uploads/mediawiki-import/ (BlueSpice images)
#   - uploads/docs-migration/ (docs images)
#   - resources/MOBIUS+Wiki-*.xml (BlueSpice export)
#   - scripts/ (import scripts and dependencies)
#
# Usage:
#   ./scripts/package-production.sh
#   ./scripts/package-production.sh --output /path/to/output.tar.gz

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

# Output file
OUTPUT_FILE="${BACKEND_DIR}/production-data.tar.gz"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --output|-o)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Package Production Data"
      echo ""
      echo "Creates a tarball containing all files needed for production deployment."
      echo ""
      echo "Usage:"
      echo "  ./scripts/package-production.sh [options]"
      echo ""
      echo "Options:"
      echo "  --output, -o <path>   Output file path (default: backend/production-data.tar.gz)"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "Contents:"
      echo "  - seeds/*.sql         SQL seed files for platform wikis"
      echo "  - uploads/            Uploaded media files"
      echo "  - resources/          BlueSpice XML export"
      echo "  - scripts/            Import scripts"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}MOBIUS Wiki - Package Production Data${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Create temporary directory for staging
STAGING_DIR=$(mktemp -d)
trap "rm -rf $STAGING_DIR" EXIT

echo -e "${YELLOW}Staging directory: ${STAGING_DIR}${NC}"
echo ""

# Create directory structure
mkdir -p "${STAGING_DIR}/seeds"
mkdir -p "${STAGING_DIR}/scripts/lib"
mkdir -p "${STAGING_DIR}/uploads"
mkdir -p "${STAGING_DIR}/resources"

# Step 1: Copy seed files
echo -e "${GREEN}[1/5]${NC} Copying seed files..."
if ls "${BACKEND_DIR}/seeds"/*.sql 1>/dev/null 2>&1; then
  cp "${BACKEND_DIR}/seeds"/*.sql "${STAGING_DIR}/seeds/"
  echo "      ✓ $(ls "${BACKEND_DIR}/seeds"/*.sql | wc -l) seed files"
else
  echo "      ⚠ No seed files found"
fi

# Step 2: Copy import scripts
echo -e "${GREEN}[2/5]${NC} Copying import scripts..."
SCRIPTS=(
  "reset-and-import.js"
  "import-mediawiki.js"
  "import-mediawiki-files.js"
  "migrate-docs.js"
  "import-docs-images.js"
  "sql.js"
  "seed-setup.js"
)

for script in "${SCRIPTS[@]}"; do
  if [ -f "${SCRIPT_DIR}/${script}" ]; then
    cp "${SCRIPT_DIR}/${script}" "${STAGING_DIR}/scripts/"
    echo "      ✓ ${script}"
  fi
done

# Copy lib directory if it exists
if [ -d "${SCRIPT_DIR}/lib" ]; then
  cp -r "${SCRIPT_DIR}/lib"/* "${STAGING_DIR}/scripts/lib/"
  echo "      ✓ lib/ directory"
fi

# Step 3: Copy BlueSpice XML export
echo -e "${GREEN}[3/5]${NC} Copying BlueSpice XML..."
XML_FILES=$(find "${PROJECT_ROOT}/resources" -maxdepth 1 -name "MOBIUS*.xml" 2>/dev/null || true)
if [ -n "$XML_FILES" ]; then
  for xml in $XML_FILES; do
    cp "$xml" "${STAGING_DIR}/resources/"
    echo "      ✓ $(basename "$xml")"
  done
else
  echo "      ⚠ No BlueSpice XML found in resources/"
fi

# Step 4: Copy uploaded media
echo -e "${GREEN}[4/5]${NC} Copying uploaded media..."

# MediaWiki imports
if [ -d "${BACKEND_DIR}/uploads/mediawiki-import" ]; then
  cp -r "${BACKEND_DIR}/uploads/mediawiki-import" "${STAGING_DIR}/uploads/"
  COUNT=$(find "${BACKEND_DIR}/uploads/mediawiki-import" -type f | wc -l)
  echo "      ✓ mediawiki-import/ (${COUNT} files)"
fi

# Docs migration images
if [ -d "${BACKEND_DIR}/uploads/docs-migration" ]; then
  cp -r "${BACKEND_DIR}/uploads/docs-migration" "${STAGING_DIR}/uploads/"
  COUNT=$(find "${BACKEND_DIR}/uploads/docs-migration" -type f | wc -l)
  echo "      ✓ docs-migration/ (${COUNT} files)"
fi

# General uploads (but not test files)
if [ -d "${BACKEND_DIR}/uploads" ]; then
  find "${BACKEND_DIR}/uploads" -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.pdf" \) -exec cp {} "${STAGING_DIR}/uploads/" \; 2>/dev/null || true
fi

# Step 5: Create package.json snippet for reference
echo -e "${GREEN}[5/5]${NC} Creating deployment instructions..."
cat > "${STAGING_DIR}/DEPLOY.md" << 'EOF'
# Production Data Deployment

This package contains clean production data for MOBIUS Wiki.

## Prerequisites

- Node.js 20.x
- PostgreSQL 15+ (running, with empty database)
- Dependencies installed (`npm install` in backend/)

## Quick Start

```bash
# 1. Extract package
tar -xzf production-data.tar.gz

# 2. Copy files to backend directory
cp -r seeds/* /path/to/backend/seeds/
cp -r scripts/* /path/to/backend/scripts/
cp -r uploads/* /path/to/backend/uploads/
cp -r resources/* /path/to/resources/

# 3. Run migrations
cd backend
npm run migrate

# 4. Import clean data
npm run db:reset:clean
```

## Manual Steps (Alternative)

```bash
# 1. Run migrations
npm run migrate

# 2. Seed base data (libraries, users, Site wiki)
npm run db:seed

# 3. Seed Help wiki
npm run sql -- --file seeds/003_help_wiki.sql

# 4. Seed FAQ wiki
npm run sql -- --file seeds/004_faq_wiki.sql

# 5. Import BlueSpice content (FOLIO, EDS, OpenRS, Panorama)
node scripts/import-mediawiki.js --file ../resources/MOBIUS+Wiki-*.xml

# 6. Import MOBIUS Documentation (requires resources/docs/ git repo)
node scripts/migrate-docs.js

# 7. Import documentation images
node scripts/import-docs-images.js
```

## Expected Result

After import, you should have 8 wikis:

| Wiki | Slug | Source |
|------|------|--------|
| MOBIUS Documentation | docs | AsciiDoc repo |
| FOLIO | folio | BlueSpice XML |
| OpenRS | openrs | BlueSpice XML |
| EDS | eds | BlueSpice XML |
| Panorama | panorama | BlueSpice XML |
| Help | help | SQL seed |
| FAQ | faq | SQL seed |
| Site | site | SQL seed |

## Login Credentials

- Email: admin@mobius.org
- Password: admin123

## Verification

```bash
npm run sql "SELECT slug, title FROM wiki.wikis WHERE deleted_at IS NULL ORDER BY id"
```
EOF

echo "      ✓ DEPLOY.md created"

# Create the tarball
echo ""
echo -e "${YELLOW}Creating archive...${NC}"
cd "${STAGING_DIR}"
tar -czf "${OUTPUT_FILE}" *
cd - > /dev/null

# Show summary
SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Package created successfully!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Output: ${OUTPUT_FILE}"
echo "Size:   ${SIZE}"
echo ""
echo "Contents:"
echo "  - seeds/          SQL seed files"
echo "  - scripts/        Import scripts"
echo "  - uploads/        Media files"
echo "  - resources/      BlueSpice XML"
echo "  - DEPLOY.md       Deployment instructions"
echo ""
echo "To extract:"
echo "  tar -xzf $(basename "${OUTPUT_FILE}")"
