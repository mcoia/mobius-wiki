#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "Migration Status"
echo "Database: ${DATABASE_NAME}"
echo "================================================"

# Check if migration tracking table exists
table_exists=$(psql $DATABASE_URL -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations' AND table_schema = 'wiki');" 2>/dev/null | xargs)

if [ "$table_exists" != "t" ]; then
  echo "⚠️  Migration tracking table does not exist yet"
  echo "Run: npm run migrate"
  exit 0
fi

# Show applied migrations
echo ""
echo "Applied migrations:"
psql $DATABASE_URL -c "SELECT migration_name, applied_at FROM wiki.schema_migrations ORDER BY applied_at;"

# Show pending migrations
echo ""
echo "Pending migrations:"
applied=$(psql $DATABASE_URL -t -c "SELECT migration_name FROM wiki.schema_migrations;" 2>/dev/null | xargs)

pending=false
for migration in $(ls migrations/*.sql | grep -v "000_migration_tracking.sql" | sort); do
  migration_name=$(basename $migration)
  if ! echo "$applied" | grep -q "$migration_name"; then
    echo "  - $migration_name"
    pending=true
  fi
done

if [ "$pending" = false ]; then
  echo "  (none - all migrations applied)"
fi
