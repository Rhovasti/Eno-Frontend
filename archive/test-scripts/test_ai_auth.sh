#!/bin/bash

echo "=== Testing AI Authentication Flow ==="

API_URL="https://www.iinou.eu"

# Test login and get token
echo "1. Testing login as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}' \
  -c cookies.txt \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n 1)
BODY=$(echo "$LOGIN_RESPONSE" | head -n -1)

echo "Login response code: $HTTP_CODE"
echo "Login response: $BODY"

# Extract token from cookies
TOKEN=$(grep -o 'token[[:space:]]*[^;]*' cookies.txt | cut -d$'\t' -f2)
echo -e "\nToken extracted: ${TOKEN:0:50}..."

# Test user profile to see roles
echo -e "\n2. Testing user profile..."
PROFILE_RESPONSE=$(curl -s "$API_URL/api/user" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt)
echo "Profile response: $PROFILE_RESPONSE"

# Test AI endpoint
echo -e "\n3. Testing AI game description endpoint..."
AI_RESPONSE=$(curl -s -X POST "$API_URL/api/ai/generate-game-description" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt \
  -d '{
    "genre": "fantasy",
    "theme": "dragons and magic",
    "keywords": ["adventure", "mystery"],
    "targetAudience": "experienced players"
  }' \
  -w "\n%{http_code}")

AI_HTTP_CODE=$(echo "$AI_RESPONSE" | tail -n 1)
AI_BODY=$(echo "$AI_RESPONSE" | head -n -1)

echo "AI response code: $AI_HTTP_CODE"
echo "AI response: $AI_BODY"

# Clean up
rm -f cookies.txt

echo -e "\n=== Test complete ==="