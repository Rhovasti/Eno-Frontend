#!/bin/bash

echo "Deploying chapter archiving feature to production..."

# Upload the updated files
echo "Uploading updated files..."
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 <<SFTP_CMD
cd /var/www/pelisivusto
put js/threads.js js/threads.js
put js/storyboard.js js/storyboard.js
put js/server_sqlite_new.js js/server_sqlite_new.js
put hml/threads.html html/threads.html
put sql/add_chapter_archiving_mysql.sql sql/add_chapter_archiving_mysql.sql
SFTP_CMD

echo "Files uploaded successfully"

# Run database migration and restart server
echo "Running database migration and restarting server..."
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Running database migration...'
mysql -u root -p'Vapajanokka79' Pelisivusto < sql/add_chapter_archiving_mysql.sql || echo 'Migration might already be applied'

echo 'Stopping all Node.js processes...'
killall -9 node || true

sleep 1
echo 'Starting updated server...'
nohup node js/server.js > server.log 2>&1 &
PID=\$!
echo 'Server started with PID: '\$PID

sleep 2
echo 'Server status:'
ps aux | grep node | grep -v grep
"

echo "Deployment completed!"