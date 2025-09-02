#!/bin/bash

echo "Fixing archive checkbox visibility..."

sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# Add more detailed debugging
cat >> js/threads.js << 'DEBUG'

// DEBUG: Add console logging for archive checkbox
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const gmCheckbox = document.getElementById('isGMPost');
        const archiveLabel = document.getElementById('archiveChapterLabel');
        console.log('DEBUG: GM checkbox found:', gmCheckbox);
        console.log('DEBUG: Archive label found:', archiveLabel);
        
        if (gmCheckbox) {
            console.log('DEBUG: Adding change listener to GM checkbox');
            gmCheckbox.addEventListener('change', function() {
                console.log('DEBUG: GM checkbox changed, checked:', this.checked);
                if (archiveLabel) {
                    console.log('DEBUG: Setting archive label visibility');
                    archiveLabel.style.display = this.checked ? 'block' : 'none';
                }
            });
        }
    }, 1000);
});
DEBUG

echo "Added enhanced debugging for archive checkbox"

# Also check if the elements are being found correctly in the original code
echo -e "\nChecking element initialization..."
grep -n "getElementById.*isGMPost\|getElementById.*archiveChapterLabel" js/threads.js | head -5

# Force the archive label to be visible for testing
echo -e "\nTemporarily making archive label visible for testing..."
sed -i 's/<label id="archiveChapterLabel" style="display:none;/<label id="archiveChapterLabel" style="display:block; background-color: yellow;/' hml/threads.html

echo "Archive label temporarily made visible with yellow background for debugging"
EOF