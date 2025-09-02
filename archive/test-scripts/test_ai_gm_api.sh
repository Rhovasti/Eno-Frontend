#!/bin/bash

echo "=== Testing AI GM API Endpoints ==="

API_URL="https://www.iinou.eu"

# First login to get a token
echo "1. Logging in as test user..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "mikko", "password": "salasana123"}' \
  -c cookies.txt \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n 1)
echo "Login response code: $HTTP_CODE"

if [ "$HTTP_CODE" != "200" ]; then
    echo "Login failed. Trying with email..."
    LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/login" \
      -H "Content-Type: application/json" \
      -d '{"email": "mikko@sahko.posti", "password": "salasana123"}' \
      -c cookies.txt \
      -w "\n%{http_code}")
    HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n 1)
    echo "Login response code: $HTTP_CODE"
fi

# Extract token
TOKEN=$(grep -o 'token[[:space:]]*[^;]*' cookies.txt | cut -d$'\t' -f2)
echo "Token extracted: ${TOKEN:0:20}..."

# Test AI GM profiles endpoint
echo -e "\n2. Testing AI GM profiles endpoint..."
PROFILES_RESPONSE=$(curl -s "$API_URL/api/ai-gm-profiles" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt \
  -w "\n%{http_code}")

PROFILES_CODE=$(echo "$PROFILES_RESPONSE" | tail -n 1)
PROFILES_BODY=$(echo "$PROFILES_RESPONSE" | head -n -1)

echo "Profiles response code: $PROFILES_CODE"
echo "Profiles response (first 200 chars): ${PROFILES_BODY:0:200}"

# Test game creation
echo -e "\n3. Testing game creation endpoint..."
GAME_RESPONSE=$(curl -s -X POST "$API_URL/api/player-game-requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt \
  -d '{
    "ai_gm_profile_id": 1,
    "game_title": "Test AI Game",
    "genre": "fantasy",
    "theme": "test theme",
    "max_players": 1
  }' \
  -w "\n%{http_code}")

GAME_CODE=$(echo "$GAME_RESPONSE" | tail -n 1)
GAME_BODY=$(echo "$GAME_RESPONSE" | head -n -1)

echo "Game creation response code: $GAME_CODE"
echo "Game creation response: $GAME_BODY"

# Clean up
rm -f cookies.txt

echo -e "\n=== Test complete ==="