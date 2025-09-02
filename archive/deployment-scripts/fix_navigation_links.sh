#!/bin/bash

echo "Fixing navigation links to storyboard..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Fixing index.html navigation ==='
sed -i 's|href=\"/storyboard.html\"|href=\"/hml/storyboard.html\"|g' index.html
echo 'Fixed index.html'

echo '=== Fixing other pages navigation ==='
# Fix all HTML files that have incorrect storyboard links
find . -name '*.html' -exec grep -l 'href=\"/storyboard.html\"' {} \; | while read file; do
    echo \"Fixing \$file\"
    sed -i 's|href=\"/storyboard.html\"|href=\"/hml/storyboard.html\"|g' \"\$file\"
done

echo '=== Verifying all storyboard links ==='
echo 'Files with correct storyboard links (/hml/storyboard.html):'
grep -r 'href=\"/hml/storyboard.html\"' --include='*.html' . | cut -d: -f1 | sort | uniq

echo
echo '=== Testing archived content ==='
# Check if there are any archived chapters to display
sqlite3 data/database.sqlite 'SELECT c.title, c.archived_at, g.name FROM chapters c JOIN games g ON c.game_id = g.id WHERE c.is_archived = 1;'

echo
echo 'Navigation links fixed!'
echo 'The correct storyboard URL is: https://www.iinou.eu/hml/storyboard.html'
echo
echo 'The storyboard will show:'
echo '- All games with archived chapters'
echo '- GM posts from each archived chapter in chronological order'
echo '- Archive dates for each chapter'
"