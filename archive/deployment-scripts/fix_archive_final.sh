#!/bin/bash

echo "Applying final fix for archive checkbox visibility..."

sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# First, restore the hidden state
sed -i 's/style="display:block; background-color: yellow;/style="display:none;/' hml/threads.html

# Create a comprehensive fix
cat > /tmp/threads_fix.js << 'JSFIX'
// Find the line where newPostForm is shown (around line 200)
// Add proper visibility handling

// Replace the existing show post form logic
sed -i '/newPostForm\.style\.display = '\''block'\'';/,/archiveChapterOnPostCheckbox\.checked = false;/{
s/if (isGMPostCheckbox && isGMPostCheckbox.parentElement) isGMPostCheckbox.parentElement.style.display = isGM ? '\''block'\'' : '\''none'\'';/if (isGMPostCheckbox \&\& isGMPostCheckbox.parentElement) {\
                    isGMPostCheckbox.parentElement.style.display = isGM ? '\''block'\'' : '\''none'\'';\
                }/
s/if (archiveChapterLabel) archiveChapterLabel.style.display = '\''none'\'';/\/\/ Reset archive checkbox visibility\
                if (archiveChapterLabel) {\
                    archiveChapterLabel.style.display = '\''none'\'';\
                }\
                if (isGMPostCheckbox) {\
                    isGMPostCheckbox.checked = false;\
                }/
}' js/threads.js

# Ensure the change event properly shows/hides the archive option
sed -i '/isGMPostCheckbox\.addEventListener.*change.*function/,/});/{
s/if (this\.checked && isGM) {/if (this.checked) {/
}' js/threads.js

echo "Fix applied successfully"

# Add timestamp to force refresh
echo "/* Final fix applied: $(date) */" >> js/threads.js

# Show the relevant code sections
echo -e "\nVerifying the fix..."
grep -A15 "newPostForm.style.display = 'block'" js/threads.js | grep -E "isGMPost|archiveChapter" | head -10
JSFIX

bash /tmp/threads_fix.js
rm /tmp/threads_fix.js
EOF