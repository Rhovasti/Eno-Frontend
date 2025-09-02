#\!/bin/bash

# Connect to the remote server and check the API directly on port 3000
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 '
echo "=== Testing API directly on port 3000 ==="
curl -v http://localhost:3000/api/posts
echo "========================================"
'

echo "API direct check completed"
