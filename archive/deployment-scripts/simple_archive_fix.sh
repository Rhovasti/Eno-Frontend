#!/bin/bash

echo "Applying simple fix for archive checkbox..."

sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# Restore normal display state
sed -i 's/style="display:block; background-color: yellow;/style="display:none;/' hml/threads.html

# Fix the GM checkbox change handler - remove the isGM check since only GMs see the checkbox anyway
sed -i 's/if (this\.checked && isGM) {/if (this.checked) {/' js/threads.js

# Add logging to the event handler
sed -i '/isGMPostCheckbox\.addEventListener.*change.*function/a\            console.log("GM checkbox changed:", this.checked);' js/threads.js

# Also ensure the archive label is properly hidden when form is first shown
sed -i '/newPostForm\.style\.display = .block.;/a\                \/\/ Ensure archive option is hidden initially\
                if (archiveChapterLabel) archiveChapterLabel.style.display = "none";\
                if (isGMPostCheckbox) isGMPostCheckbox.checked = false;' js/threads.js

echo "Simple fix applied"

# Force cache refresh
echo "/* Simple fix: $(date) */" >> js/threads.js

# Verify the changes
echo -e "\nVerifying changes..."
grep -B2 -A5 "if (this.checked)" js/threads.js | head -10
EOF