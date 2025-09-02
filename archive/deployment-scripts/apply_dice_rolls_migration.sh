#!/bin/bash

echo "Applying dice rolls migration to SQLite database..."

# Run the SQL migration
sqlite3 data/foorumi.db < sql/add_dice_rolls.sql

if [ $? -eq 0 ]; then
    echo "✓ Dice rolls table created successfully"
else
    echo "✗ Failed to create dice rolls table"
    exit 1
fi

echo "Migration completed!"