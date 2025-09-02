#!/bin/bash

echo "Adding archive chapter button to threads.html..."

# Add the archive button to production
sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

# Backup the file
cp hml/threads.html hml/threads.html.backup_$(date +%Y%m%d_%H%M%S)

# Add the archive button after the "Luo Uusi Beatti" button
sed -i '/<button id="createBeatButton"/a\        <button id="archiveChapterButton" disabled style="margin-left: 10px; background-color: #dc3545;">Arkistoi Luku</button>' hml/threads.html

echo "Archive button added to HTML"

# Also ensure the archive label text is in Finnish
sed -i 's/Archive this chapter after posting/Arkistoi tämä luku viestin lähetyksen jälkeen/' hml/threads.html

# Fix the GM post label to Finnish
sed -i 's/Post as Game Master/GM-viesti/' hml/threads.html

echo "Updated labels to Finnish"

# Verify the changes
echo "Verifying changes..."
grep -n "archiveChapterButton\|archiveChapterLabel\|archiveChapterOnPost" hml/threads.html
EOF