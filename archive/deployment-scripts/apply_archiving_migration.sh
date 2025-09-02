#!/bin/bash

# Apply archiving migration to SQLite database

echo "Applying archiving migration to SQLite database..."

# Apply the migration
sqlite3 data/database.sqlite < sql/add_chapter_archiving.sql

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
else
    echo "Error applying migration."
    exit 1
fi