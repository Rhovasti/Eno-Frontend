#!/bin/bash

echo "Checking UI errors on production..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Recent server logs (last 30 lines) ==='
tail -30 server.log
echo

echo '=== Check browser console errors via server logs ==='
grep -i 'error\\|POST.*posts' server.log | tail -10
echo

echo '=== Verify threads.js is the updated version ==='
grep -n 'archiveChapter' js/threads.js | head -3
echo

echo '=== Check if there are any JavaScript syntax errors ==='
node -c js/threads.js && echo 'threads.js syntax is valid' || echo 'threads.js has syntax errors'
echo

echo '=== Check database write permissions ==='
ls -la data/
echo

echo '=== Monitor server logs (press Ctrl+C to stop) ==='
echo 'Try to create a post from the UI while this is running...'
tail -f server.log | grep -E 'POST|post|error|Error'
"