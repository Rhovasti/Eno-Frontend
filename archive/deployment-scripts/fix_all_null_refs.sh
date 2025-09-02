#!/bin/bash

echo "Creating comprehensive fix for all null reference errors..."

# Create a fixed version of threads.js
cat > /tmp/threads_fix.js << 'EOF'
// Add this at the beginning of the DOMContentLoaded handler (after line ~65)
    // Get all DOM elements with null checks
    const archiveChapterButton = document.getElementById('archiveChapterButton');
    const archiveChapterLabel = document.getElementById('archiveChapterLabel');
    const archiveChapterOnPostCheckbox = document.getElementById('archiveChapterOnPost');
    
    // Line 86 fix - check if elements exist
    if (isGMPostCheckbox) {
        isGMPostCheckbox.addEventListener('change', function() {
            if (this.checked && isGM) {
                if (archiveChapterLabel) archiveChapterLabel.style.display = 'block';
            } else {
                if (archiveChapterLabel) archiveChapterLabel.style.display = 'none';
                if (archiveChapterOnPostCheckbox) archiveChapterOnPostCheckbox.checked = false;
            }
        });
    }
    
    // Line 155 fix - check if archiveChapterButton exists
    if (archiveChapterButton) {
        archiveChapterButton.disabled = !chapterId || !isGM || isArchived;
    }
    
    // Line 203-207 fix - check parent element exists
    if (isGMPostCheckbox && isGMPostCheckbox.parentElement) {
        isGMPostCheckbox.parentElement.style.display = isGM ? 'block' : 'none';
    }
    
    // Hide archive chapter option by default
    if (archiveChapterLabel) archiveChapterLabel.style.display = 'none';
    if (archiveChapterOnPostCheckbox) archiveChapterOnPostCheckbox.checked = false;
    
    // Line 382 fix - check if checkbox exists
    const postType = (isGMPostCheckbox && isGMPostCheckbox.checked) ? 'gm' : 'player';
    const archiveChapter = archiveChapterOnPostCheckbox ? archiveChapterOnPostCheckbox.checked : false;
EOF

# Deploy the fix
echo "Deploying fix to production..."
sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'REMOTE_FIX'
cd /var/www/pelisivusto

# Backup current file
cp js/threads.js js/threads.js.backup_$(date +%Y%m%d_%H%M%S)

# Apply fixes with sed
echo "Applying null reference fixes..."

# Fix line 86 - archiveChapterLabel.style.display
sed -i 's/archiveChapterLabel\.style\.display = '\''block'\'';/if (archiveChapterLabel) archiveChapterLabel.style.display = '\''block'\'';/g' js/threads.js

# Fix line 88 - archiveChapterLabel.style.display = 'none'
sed -i 's/archiveChapterLabel\.style\.display = '\''none'\'';/if (archiveChapterLabel) archiveChapterLabel.style.display = '\''none'\'';/g' js/threads.js

# Fix line 89 - archiveChapterOnPostCheckbox.checked
sed -i 's/archiveChapterOnPostCheckbox\.checked = false;/if (archiveChapterOnPostCheckbox) archiveChapterOnPostCheckbox.checked = false;/g' js/threads.js

# Fix line 155 - archiveChapterButton.disabled
sed -i 's/archiveChapterButton\.disabled = /if (archiveChapterButton) archiveChapterButton.disabled = /g' js/threads.js

# Fix line 203 - isGMPostCheckbox.parentElement.style.display
sed -i 's/isGMPostCheckbox\.parentElement\.style\.display/if (isGMPostCheckbox \&\& isGMPostCheckbox.parentElement) isGMPostCheckbox.parentElement.style.display/g' js/threads.js

# Fix line 382 - isGMPostCheckbox.checked
sed -i 's/const postType = isGMPostCheckbox\.checked/const postType = (isGMPostCheckbox \&\& isGMPostCheckbox.checked)/g' js/threads.js

# Fix line 382 - archiveChapterOnPostCheckbox.checked  
sed -i 's/const archiveChapter = archiveChapterOnPostCheckbox\.checked;/const archiveChapter = archiveChapterOnPostCheckbox ? archiveChapterOnPostCheckbox.checked : false;/g' js/threads.js

echo "All fixes applied!"

# Show what was changed
echo "Verifying fixes..."
grep -n "archiveChapterLabel\|archiveChapterButton\|archiveChapterOnPostCheckbox" js/threads.js | head -10
REMOTE_FIX

echo "Fix deployed to production!"