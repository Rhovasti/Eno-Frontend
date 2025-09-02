#!/bin/bash

echo "Debugging archive visibility issue..."

sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
cd /var/www/pelisivusto

echo "=== Checking if archive elements exist in HTML ==="
echo "Archive button:"
grep -n "archiveChapterButton" hml/threads.html

echo -e "\nArchive checkbox:"
grep -n "archiveChapterOnPost" hml/threads.html

echo -e "\n=== Checking JavaScript references ==="
echo "Archive button visibility control:"
grep -n "archiveChapterButton" js/threads.js | grep -E "style|display|hidden"

echo -e "\n=== Checking if elements are properly initialized ==="
grep -n "getElementById.*archiveChapter" js/threads.js

echo -e "\n=== Checking Apache/Nginx cache headers ==="
if [ -f /etc/apache2/sites-enabled/000-default.conf ]; then
    grep -i "cache\|expire" /etc/apache2/sites-enabled/*.conf | head -5
fi

echo -e "\n=== Force clear any server-side cache ==="
# Clear Apache cache if exists
if [ -d /var/cache/apache2 ]; then
    rm -rf /var/cache/apache2/mod_cache_disk/*
fi

# Add cache-busting headers
cat > /tmp/htaccess_cache << 'HTACCESS'
<FilesMatch "\.(html|js|css)$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires 0
</FilesMatch>
HTACCESS

if [ ! -f .htaccess ]; then
    cp /tmp/htaccess_cache .htaccess
    echo "Added cache-busting .htaccess"
fi

echo -e "\n=== Testing with curl ==="
echo "Checking if button exists in HTML response:"
curl -s http://localhost/hml/threads.html | grep -o "archiveChapterButton" | head -1
EOF