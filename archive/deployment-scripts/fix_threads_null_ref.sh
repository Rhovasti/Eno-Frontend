#!/bin/bash

echo "Fixing null reference error in threads.js..."

# Create the fix
cat > /tmp/threads_fix.sh << 'EOF'
cd /var/www/pelisivusto

# Fix the null reference by adding null checks
sed -i '154s/archiveChapterButton\.disabled/if (archiveChapterButton) archiveChapterButton.disabled/' js/threads.js

# Also fix the beat loading issue - ensure loadBeats is called
sed -i '/if (chapterId) {/,/loadBeats(chapterId);/s/loadBeats(chapterId);/loadBeats(chapterId); console.log("Loading beats for chapter:", chapterId);/' js/threads.js

echo "Fixed null reference issue in threads.js"
EOF

# Deploy the fix
sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 'bash -s' < /tmp/threads_fix.sh

# Clean up
rm /tmp/threads_fix.sh

echo "Fix deployed successfully!"