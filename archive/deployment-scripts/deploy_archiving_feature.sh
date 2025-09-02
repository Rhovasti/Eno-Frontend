#!/bin/bash

echo "Deploying chapter archiving feature..."

# Run the MySQL migration on production
mysql -u eno -p Foorumi < sql/add_chapter_archiving_mysql.sql

echo "Database migration completed."
echo "Remember to restart the server after uploading the new code files."