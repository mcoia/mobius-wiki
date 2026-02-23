#!/bin/bash
# =============================================================================
# Create Multiple PostgreSQL Databases
# =============================================================================
# This script is run by PostgreSQL on first container startup.
# It creates both staging and production databases.
# =============================================================================

set -e
set -u

function create_database() {
    local database=$1
    echo "Creating database: $database"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        SELECT 'CREATE DATABASE $database'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$database')\gexec
EOSQL
}

# Create staging database (default is already created by POSTGRES_DB)
# Create production database
create_database "mobius_wiki_prod"

echo "Multiple databases created successfully!"
