#!/bin/bash

echo "Applying direct archive fix..."

sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# Add the setup function directly
cat >> js/threads.js << 'ARCHIVE_FIX'

// Direct fix for archive checkbox visibility
function setupArchiveVisibility() {
    setTimeout(() => {
        const gmCheckbox = document.getElementById('isGMPost');
        const archiveLabel = document.getElementById('archiveChapterLabel');
        
        if (gmCheckbox && archiveLabel) {
            console.log('Archive setup: Found both elements');
            
            gmCheckbox.onclick = function() {
                console.log('GM checkbox clicked:', this.checked);
                archiveLabel.style.display = this.checked ? 'block' : 'none';
                
                if (!this.checked) {
                    const archiveCheckbox = document.getElementById('archiveChapterOnPost');
                    if (archiveCheckbox) archiveCheckbox.checked = false;
                }
            };
            
            // Set initial state
            archiveLabel.style.display = gmCheckbox.checked ? 'block' : 'none';
        } else {
            console.log('Archive setup: Missing elements', {gmCheckbox: !!gmCheckbox, archiveLabel: !!archiveLabel});
        }
    }, 500);
}

// Call when beat is selected and form is shown
const originalLoadPosts = loadPosts;
loadPosts = function(beatId) {
    originalLoadPosts(beatId);
    setTimeout(setupArchiveVisibility, 100);
};

// Also call on page load
setupArchiveVisibility();
ARCHIVE_FIX

echo "Direct fix applied!"
echo "/* Direct archive fix: $(date) */" >> js/threads.js
EOF