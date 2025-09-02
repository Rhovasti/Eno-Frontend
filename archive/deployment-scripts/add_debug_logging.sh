#!/bin/bash

echo "Adding debug logging to production..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Create a debug version of threads.js
cp js/threads.js js/threads_debug.js

# Add console logging to the debug version
cat > add_debug.js << 'DEBUG_SCRIPT'
const fs = require('fs');

let content = fs.readFileSync('js/threads_debug.js', 'utf8');

// Add debug logging right at the start of the post form submission
content = content.replace(
    'createPostForm.addEventListener(\\'submit\\', function(event) {',
    'createPostForm.addEventListener(\\'submit\\', function(event) {\n        console.log(\"Post form submitted\");'
);

// Add logging after getting values
content = content.replace(
    'const archiveChapter = archiveChapterOnPostCheckbox.checked;',
    'const archiveChapter = archiveChapterOnPostCheckbox.checked;\n        console.log(\"Form values:\", {beatId, title, content, postType, archiveChapter});'
);

// Add logging before fetch
content = content.replace(
    'fetch(\\'/api/posts\\', {',
    'console.log(\"Sending POST request to /api/posts\");\n        fetch(\\'/api/posts\\', {'
);

// Add error logging
content = content.replace(
    '.catch(error => {',
    '.catch(error => {\n                console.error(\"Full error details:\", error);'
);

fs.writeFileSync('js/threads_debug.js', content);
console.log('Debug logging added to threads_debug.js');
DEBUG_SCRIPT

node add_debug.js

# Replace the production file with debug version
cp js/threads_debug.js js/threads.js

echo 'Debug logging added. You can now:'
echo '1. Open the browser console (F12)'
echo '2. Try to create a post'
echo '3. Check the console for debug messages'
echo ''
echo 'Server logs can be monitored with:'
echo 'tail -f server.log'
"