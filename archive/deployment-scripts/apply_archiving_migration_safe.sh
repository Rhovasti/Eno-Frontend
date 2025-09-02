#!/bin/bash

# Apply archiving migration to SQLite database (with safety checks)

echo "Checking if archiving migration is needed..."

# Check if columns already exist
BEATS_COLS=$(sqlite3 data/database.sqlite "PRAGMA table_info(beats)" | grep -E "(title|content)" | wc -l)
CHAPTERS_COLS=$(sqlite3 data/database.sqlite "PRAGMA table_info(chapters)" | grep -E "(is_archived|archived_at|archived_narrative)" | wc -l)

if [ $BEATS_COLS -ge 2 ] && [ $CHAPTERS_COLS -ge 3 ]; then
    echo "Migration already applied. All required columns exist."
    exit 0
fi

echo "Applying archiving migration to SQLite database..."

# Apply the migration
sqlite3 data/database.sqlite < sql/add_chapter_archiving.sql

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
else
    echo "Error applying migration."
    exit 1
fi