#!/bin/bash

echo "Diagnosing post creation issue on production..."

# Production server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

echo "=== Checking server process ==="
ps aux | grep node | grep -v grep

echo -e "\n=== Checking database tables ==="
sqlite3 data/database.sqlite ".tables"

echo -e "\n=== Checking beats table structure ==="
sqlite3 data/database.sqlite ".schema beats"

echo -e "\n=== Checking if there are any beats ==="
sqlite3 data/database.sqlite "SELECT COUNT(*) as total_beats FROM beats;"

echo -e "\n=== Checking last 5 beats ==="
sqlite3 data/database.sqlite "SELECT id, chapter_id, title, sequence_number FROM beats ORDER BY id DESC LIMIT 5;"

echo -e "\n=== Checking posts table structure ==="
sqlite3 data/database.sqlite ".schema posts"

echo -e "\n=== Checking last 5 posts ==="
sqlite3 data/database.sqlite "SELECT id, beat_id, title, post_type, created_at FROM posts ORDER BY id DESC LIMIT 5;"

echo -e "\n=== Checking server logs for errors ==="
tail -30 server.log | grep -E "Error|error|POST.*posts|beatId"

echo -e "\n=== Testing API endpoint directly ==="
# First login as admin to get token
RESPONSE=$(curl -s -X POST https://www.iinou.eu/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

TOKEN=$(echo $RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
    echo "Login successful, token obtained"
    
    # Try to get games
    echo -e "\n=== Testing games endpoint ==="
    curl -s -H "Authorization: Bearer $TOKEN" https://www.iinou.eu/api/games | head -50
    
    # Try to get chapters for game 1
    echo -e "\n=== Testing chapters endpoint ==="
    curl -s -H "Authorization: Bearer $TOKEN" https://www.iinou.eu/api/games/1/chapters | head -50
else
    echo "Login failed. Response: $RESPONSE"
fi
EOF