#!/bin/bash

echo "Applying simple delegated event fix..."

# Create a simple JavaScript fix file
cat > /tmp/archive_fix.js << 'JSFIX'
// Simple event delegation fix for archive checkbox
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'isGMPost') {
        const label = document.getElementById('archiveChapterLabel');
        if (label) {
            label.style.display = e.target.checked ? 'block' : 'none';
            console.log('Archive label visibility:', e.target.checked ? 'shown' : 'hidden');
        }
    }
});
JSFIX

# Upload and append the fix
sshpass -p "ininFvTPNTguUtuuLbx3" scp -o StrictHostKeyChecking=no /tmp/archive_fix.js root@95.217.21.111:/tmp/

sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# Append the fix
cat /tmp/archive_fix.js >> js/threads.js

# Remove the line that hides archive label when showing form
sed -i '/newPostForm\.style\.display = .block.;/,+10 s/if (archiveChapterLabel) archiveChapterLabel\.style\.display = "none";//g' js/threads.js

echo "Simple fix applied!"

# Force refresh
echo "/* Delegated fix: $(date) */" >> js/threads.js
EOF

rm /tmp/archive_fix.js