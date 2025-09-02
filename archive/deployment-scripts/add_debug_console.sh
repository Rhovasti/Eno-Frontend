#!/bin/bash

echo "Adding debug console logs to check element visibility..."

sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# Add debug logging at the start of the script
sed -i '/document\.addEventListener.*DOMContentLoaded.*function/a\    console.log("DEBUG: Threads page loaded");' js/threads.js

# Add logging after getting archive elements
sed -i '/const archiveChapterButton = document\.getElementById.*archiveChapterButton/a\    console.log("DEBUG: archiveChapterButton element:", archiveChapterButton);' js/threads.js

# Add logging to check user roles
sed -i '/const isGM = roles\.includes/a\    console.log("DEBUG: User roles:", roles, "isGM:", isGM, "is_admin:", user.is_admin);' js/threads.js

# Also add a version timestamp to force cache refresh
echo "/* Updated: $(date) */" >> js/threads.js

echo "Debug logging added. Check browser console for debug messages."
EOF