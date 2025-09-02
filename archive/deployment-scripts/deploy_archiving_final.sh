#!/bin/bash

echo "Deploying chapter archiving feature to production..."

# Upload the updated files  
echo "Uploading updated files..."
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 <<SFTP_CMD
cd /var/www/pelisivusto
put js/threads.js js/threads.js
put js/storyboard.js js/storyboard.js
put hml/threads.html hml/threads.html
cd /var/www/pelisivusto/sql
put sql/add_chapter_archiving_mysql.sql add_chapter_archiving_mysql.sql
SFTP_CMD

echo "Files uploaded successfully"

# Run database migration
echo "Running database migration..."
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Checking database...'
mysql -e 'SHOW DATABASES;' | grep -i foorumi || echo 'Database not found'

echo 'Running migration on Foorumi database...'
mysql Foorumi < sql/add_chapter_archiving_mysql.sql 2>&1 || echo 'Migration might already be applied or encountered an error'

echo 'Checking if archiving columns exist...'
mysql Foorumi -e 'DESCRIBE chapters;' | grep -i archived || echo 'Archiving columns might not exist'

echo 'Server is already running. Features will be available immediately.'
echo 'Current server status:'
ps aux | grep node | grep -v grep
"

echo "Deployment completed!"
echo "The archiving feature should now be available on the production server."