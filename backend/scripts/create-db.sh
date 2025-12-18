#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Create database if it doesn't exist
echo "Creating database '${DATABASE_NAME}' if it doesn't exist..."

# Check if database exists
DB_EXISTS=$(psql -U ${DATABASE_USER} -h ${DATABASE_HOST} -p ${DATABASE_PORT} -lqt | cut -d \| -f 1 | grep -qw ${DATABASE_NAME}; echo $?)

if [ $DB_EXISTS -eq 0 ]; then
  echo "Database '${DATABASE_NAME}' already exists."
else
  # Create database
  createdb -U ${DATABASE_USER} -h ${DATABASE_HOST} -p ${DATABASE_PORT} ${DATABASE_NAME}
  echo "Database '${DATABASE_NAME}' created successfully."
fi

echo "Done!"
