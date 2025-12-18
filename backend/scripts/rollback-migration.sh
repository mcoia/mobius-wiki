#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "Rolling back last migration"
echo "Database: ${DATABASE_NAME}"
echo "================================================"

# Get the last applied migration
last_migration=$(psql $DATABASE_URL -t -c "SELECT migration_name FROM wiki.schema_migrations ORDER BY applied_at DESC LIMIT 1;" 2>/dev/null | xargs)

if [ -z "$last_migration" ]; then
  echo "No migrations to rollback"
  exit 0
fi

echo "Last migration: $last_migration"

# Check if a rollback file exists
rollback_file="migrations/rollback_$(echo $last_migration | sed 's/.sql$//')"

if [ ! -f "$rollback_file" ]; then
  echo "⚠️  Warning: No rollback file found at $rollback_file"
  echo "You will need to manually rollback this migration"
  echo ""
  echo "To manually rollback:"
  echo "  psql \$DATABASE_URL"
  echo "  -- Review what $last_migration created and write DROP statements"
  echo "  DELETE FROM wiki.schema_migrations WHERE migration_name = '$last_migration';"
  exit 1
fi

echo "Running rollback: $rollback_file"
psql $DATABASE_URL -f $rollback_file

if [ $? -eq 0 ]; then
  # Remove migration from tracking table
  psql $DATABASE_URL -c "DELETE FROM wiki.schema_migrations WHERE migration_name = '$last_migration';" > /dev/null
  echo "✅ Successfully rolled back: $last_migration"
else
  echo "❌ Rollback failed for: $last_migration"
  exit 1
fi

echo ""
echo "Remaining migrations:"
psql $DATABASE_URL -c "SELECT migration_name, applied_at FROM wiki.schema_migrations ORDER BY applied_at;"
