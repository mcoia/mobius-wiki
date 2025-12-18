#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "Running database migrations"
echo "Database: ${DATABASE_NAME}"
echo "================================================"

# First, ensure migration tracking table exists
echo "Setting up migration tracking..."
psql $DATABASE_URL -f migrations/000_migration_tracking.sql > /dev/null 2>&1

if [ $? -ne 0 ]; then
  echo "❌ Failed to create migration tracking table"
  exit 1
fi

# Get list of all migration files (excluding 000_migration_tracking.sql)
for migration in $(ls migrations/*.sql | grep -v "000_migration_tracking.sql" | sort); do
  migration_name=$(basename $migration)

  # Check if migration has already been applied
  already_applied=$(psql $DATABASE_URL -t -c "SELECT COUNT(*) FROM wiki.schema_migrations WHERE migration_name = '$migration_name';" 2>/dev/null | xargs)

  if [ "$already_applied" = "1" ]; then
    echo "⏭️  Skipping: $migration_name (already applied)"
    continue
  fi

  echo "Running: $migration_name"
  psql $DATABASE_URL -f $migration

  if [ $? -eq 0 ]; then
    # Record migration in tracking table
    psql $DATABASE_URL -c "INSERT INTO wiki.schema_migrations (migration_name) VALUES ('$migration_name');" > /dev/null
    echo "✅ Success: $migration_name"
  else
    echo "❌ Failed: $migration_name"
    exit 1
  fi
  echo ""
done

echo "================================================"
echo "All migrations completed successfully!"
echo ""
echo "Applied migrations:"
psql $DATABASE_URL -c "SELECT migration_name, applied_at FROM wiki.schema_migrations ORDER BY applied_at;"
