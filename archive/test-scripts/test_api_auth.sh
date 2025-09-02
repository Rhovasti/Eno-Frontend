#\!/bin/bash

# Get a token and test the API with authentication
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Getting authentication token...'
TOKEN=\$(curl -s -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"admin123\"}' | grep -o '\"token\":\"[^\"]*\"' | cut -d '\"' -f 4)

if [ -z \"\$TOKEN\" ]; then
  echo 'Failed to get token. Trying alternate credentials...'
  TOKEN=\$(curl -s -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{\"email\":\"gm@example.com\",\"password\":\"password123\"}' | grep -o '\"token\":\"[^\"]*\"' | cut -d '\"' -f 4)
fi

if [ -z \"\$TOKEN\" ]; then
  echo 'Failed to get token. Testing endpoint without authentication...'
  echo 'API response without token:'
  curl -v http://localhost:3000/api/posts
else
  echo 'Got token. Testing endpoint with authentication...'
  echo 'API response with token:'
  curl -v -H \"Authorization: Bearer \$TOKEN\" http://localhost:3000/api/posts
fi
"

echo "API authentication test completed"
