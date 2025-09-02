#!/bin/bash

echo "Testing complete post creation flow on production..."

# Test with the actual production API
BASE_URL="https://www.iinou.eu"

# Step 1: Login
echo "=== Step 1: Login as admin ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('token', ''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo "Login failed. Response: $LOGIN_RESPONSE"
    exit 1
fi

echo "Login successful!"

# Step 2: Get games
echo -e "\n=== Step 2: Get games ==="
GAMES=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/games")
echo "Games: $GAMES"

# Get first game ID
GAME_ID=$(echo $GAMES | python3 -c "import sys, json; games=json.load(sys.stdin); print(games[0]['id'] if games else '')" 2>/dev/null)

if [ -z "$GAME_ID" ]; then
    echo "No games found"
    exit 1
fi

echo "Using game ID: $GAME_ID"

# Step 3: Get chapters
echo -e "\n=== Step 3: Get chapters for game $GAME_ID ==="
CHAPTERS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/games/$GAME_ID/chapters")
echo "Chapters: $CHAPTERS"

# Get first non-archived chapter
CHAPTER_ID=$(echo $CHAPTERS | python3 -c "import sys, json; chapters=json.load(sys.stdin); non_archived=[c for c in chapters if not c.get('is_archived')]; print(non_archived[0]['id'] if non_archived else '')" 2>/dev/null)

if [ -z "$CHAPTER_ID" ]; then
    echo "No active chapters found"
    exit 1
fi

echo "Using chapter ID: $CHAPTER_ID"

# Step 4: Get beats
echo -e "\n=== Step 4: Get beats for chapter $CHAPTER_ID ==="
BEATS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/chapters/$CHAPTER_ID/beats")
echo "Beats: $BEATS"

# Get first beat
BEAT_ID=$(echo $BEATS | python3 -c "import sys, json; beats=json.load(sys.stdin); print(beats[0]['id'] if beats else '')" 2>/dev/null)

if [ -z "$BEAT_ID" ]; then
    echo "No beats found in chapter"
    exit 1
fi

echo "Using beat ID: $BEAT_ID"

# Step 5: Try to create a post
echo -e "\n=== Step 5: Creating a test post ==="
POST_RESPONSE=$(curl -s -X POST "$BASE_URL/api/posts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"beatId\":\"$BEAT_ID\",\"title\":\"Test Post\",\"content\":\"This is a test post\",\"postType\":\"gm\"}")

echo "Post creation response: $POST_RESPONSE"

# Step 6: Check if post was created
echo -e "\n=== Step 6: Getting posts for beat $BEAT_ID ==="
POSTS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/beats/$BEAT_ID/posts")
echo "Posts in beat: $POSTS"