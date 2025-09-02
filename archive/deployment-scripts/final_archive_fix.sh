#!/bin/bash

echo "Applying final comprehensive fix for archive functionality..."

sshpass -p "ininFvTPNTguuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# Create a backup
cp js/threads.js js/threads.js.backup_final

# Remove the duplicate hiding of archive label when showing the form
sed -i '213d' js/threads.js

# Make the event listener more robust by using event delegation
cat >> js/threads.js << 'EVENTFIX'

// Add robust event handling for GM checkbox
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'isGMPost') {
        const archiveLabel = document.getElementById('archiveChapterLabel');
        const archiveCheckbox = document.getElementById('archiveChapterOnPost');
        
        console.log('GM checkbox clicked, checked:', e.target.checked);
        
        if (archiveLabel) {
            if (e.target.checked) {
                archiveLabel.style.display = 'block';
                archiveLabel.style.backgroundColor = '#f0f0f0';
                archiveLabel.style.padding = '10px';
                archiveLabel.style.border = '1px solid #ccc';
                archiveLabel.style.marginTop = '10px';
            } else {
                archiveLabel.style.display = 'none';
                if (archiveCheckbox) archiveCheckbox.checked = false;
            }
        }
    }
});
EVENTFIX

echo "Comprehensive fix applied!"

# Also fix the HTML to ensure proper structure
echo "Checking HTML structure..."
sed -i '/<label id="archiveChapterLabel"/s/style="[^"]*"/style="display:none; margin-top: 10px;"/' hml/threads.html

echo "Done! The archive checkbox should now work properly."
EOF