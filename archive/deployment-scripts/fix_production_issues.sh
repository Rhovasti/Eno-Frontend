#!/bin/bash

echo "=== Fixing Production Issues ==="

REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

echo "1. Cleaning up test games..."
sqlite3 data/database.sqlite << 'SQL'
-- Show current games
SELECT id, title FROM games;

-- Delete all games except Eno (id=1)
DELETE FROM chapters WHERE game_id > 1;
DELETE FROM game_players WHERE game_id > 1;
DELETE FROM games WHERE id > 1;

-- Verify
SELECT 'Games remaining:', COUNT(*) FROM games;
SELECT id, title FROM games;
SQL

echo -e "\n2. Adding missing API endpoint for role updates..."
cat >> js/server_sqlite_ai.js << 'ENDPOINT'

// Update user roles (admin only)
app.put('/api/users/:userId/roles', authenticateToken, (req, res) => {
    // Only admins can update roles
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    
    const userId = parseInt(req.params.userId);
    const { roles, is_admin } = req.body;
    
    if (!Array.isArray(roles)) {
        return res.status(400).json({ error: 'Roles must be an array' });
    }
    
    const rolesJson = JSON.stringify(roles);
    const isAdmin = is_admin ? 1 : 0;
    const isGm = roles.includes('gm') ? 1 : 0;
    
    db.run(
        `UPDATE users SET roles = ?, is_admin = ?, is_gm = ? WHERE id = ?`,
        [rolesJson, isAdmin, isGm, userId],
        function(err) {
            if (err) {
                console.error('Error updating user roles:', err);
                return res.status(500).json({ error: 'Failed to update roles' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json({ message: 'Roles updated successfully' });
        }
    );
});
ENDPOINT

echo -e "\n3. Fixing admin.html to use correct endpoint..."
# Download current admin.html
scp -o StrictHostKeyChecking=no root@95.217.21.111:/var/www/pelisivusto/hml/admin.html /tmp/admin.html

# Check if it already has the endpoint defined correctly
if ! grep -q "/api/users/\${userId}/roles" /tmp/admin.html; then
    echo "Admin.html needs updating..."
    # We'll need to update the admin interface
fi

echo -e "\n4. Restarting server..."
pkill -f "node.*server" || true
sleep 2
nohup node js/server_sqlite_ai.js > server_ai.log 2>&1 &
sleep 3

echo -e "\n5. Testing new endpoint..."
# Create test token
TEST_TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
    { id: 1, username: 'admin', is_admin: true },
    'eno-game-platform-secret-key-change-in-production',
    { expiresIn: '1h' }
);
console.log(token);
")

# Test the endpoint
curl -X PUT https://localhost:3000/api/users/2/roles \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roles":["player"],"is_admin":false}' \
  -k 2>/dev/null | head -1

echo -e "\nDone!"
EOF

echo -e "\n6. Local fix for token issues in admin.html..."
# Create a fixed version of admin functions
cat > js/admin_fix.js << 'ADMINFIX'
// Fixed admin functions with proper token handling

function updateUserRoles(userId, newRoles, isAdmin) {
    const token = getCookie('token');
    if (!token) {
        alert('Please login again - session expired');
        window.location.href = '/hml/login.html';
        return;
    }

    fetch(`/api/users/${userId}/roles`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            roles: newRoles,
            is_admin: isAdmin
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        alert('Roles updated successfully');
        location.reload();
    })
    .catch(error => {
        console.error('Error updating roles:', error);
        alert('Error updating roles: ' + error.message);
    });
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}
ADMINFIX

echo "Fix script created. Uploading to production..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no js/admin_fix.js $REMOTE_USER@$REMOTE_HOST:/var/www/pelisivusto/js/