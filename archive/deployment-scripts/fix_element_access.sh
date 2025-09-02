#!/bin/bash

echo "Fixing element access issue..."

sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# Create a fix that properly handles the elements
cat > /tmp/element_fix.js << 'FIXJS'

// Override the problematic element access
// Remove the early element access attempts
sed -i '/const archiveChapterLabel = document.getElementById.*archiveChapterLabel/d' js/threads.js
sed -i '/const archiveChapterOnPostCheckbox = document.getElementById.*archiveChapterOnPost/d' js/threads.js

// Add a function to properly setup the archive functionality when form is shown
sed -i '/newPostForm\.style\.display = .block.;/a\
                // Setup archive functionality when form is shown\
                setupArchiveCheckbox();' js/threads.js

# Add the setup function at the end of the file
cat >> js/threads.js << 'SETUPFUNC'

// Function to setup archive checkbox functionality
function setupArchiveCheckbox() {
    const gmCheckbox = document.getElementById('isGMPost');
    const archiveLabel = document.getElementById('archiveChapterLabel');
    const archiveCheckbox = document.getElementById('archiveChapterOnPost');
    
    console.log('Setting up archive checkbox - Label found:', !!archiveLabel);
    
    if (gmCheckbox && archiveLabel) {
        // Remove any existing listeners
        gmCheckbox.removeEventListener('change', handleGMCheckboxChange);
        
        // Add new listener
        gmCheckbox.addEventListener('change', handleGMCheckboxChange);
        
        // Ensure initial state is correct
        archiveLabel.style.display = gmCheckbox.checked ? 'block' : 'none';
        if (!gmCheckbox.checked && archiveCheckbox) {
            archiveCheckbox.checked = false;
        }
    }
}

// Handler function for GM checkbox
function handleGMCheckboxChange(e) {
    const archiveLabel = document.getElementById('archiveChapterLabel');
    const archiveCheckbox = document.getElementById('archiveChapterOnPost');
    
    console.log('GM checkbox changed:', e.target.checked);
    
    if (archiveLabel) {
        archiveLabel.style.display = e.target.checked ? 'block' : 'none';
    }
    
    if (!e.target.checked && archiveCheckbox) {
        archiveCheckbox.checked = false;
    }
}

// Call setup when DOM is ready (for any dynamic content)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupArchiveCheckbox);
} else {
    setupArchiveCheckbox();
}
SETUPFUNC

FIXJS

# Execute the fix
bash /tmp/element_fix.js
rm /tmp/element_fix.js

echo "Element access fix applied!"

# Add timestamp
echo "/* Element fix: $(date) */" >> js/threads.js
EOF