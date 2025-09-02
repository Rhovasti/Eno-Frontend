#!/bin/bash

echo "Diagnosing UI post creation issue..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Checking threads.js for errors ==='
# Check if archiving code exists
grep -n 'archiveChapter' js/threads.js | wc -l
echo 'archiveChapter references found'
echo

# Check post submission handler
echo '=== Post submission code in threads.js ==='
grep -A20 'createPostForm.*submit' js/threads.js | head -25
echo

echo '=== Checking if client files are updated ==='
md5sum js/threads.js
md5sum hml/threads.html
echo

echo '=== Recent errors in server log ==='
grep -i 'error' server.log | tail -10
echo

echo '=== Testing if the form IDs match ==='
grep 'id=\"postTitle\"' hml/threads.html
grep 'getElementById.*postTitle' js/threads.js
echo

echo '=== Checking required fields ==='
grep 'required' hml/threads.html | grep -E 'postTitle|postContent'
echo

echo '=== Server API endpoint ==='
grep -n 'app.post.*/api/posts' js/server_sqlite_new.js
"