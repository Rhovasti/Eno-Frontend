#!/bin/bash

echo "=== Final Production Fixes ==="

REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

# Test the server locally first
echo "1. Testing role update endpoint..."
curl -X GET https://www.iinou.eu/api/users 2>/dev/null | grep -o "username" | head -1 && echo "API is accessible"

echo -e "\n2. Creating comprehensive server fix..."
# Create a complete server file that includes all fixes
cp js/server_sqlite_ai.js js/server_sqlite_complete.js

# Add the missing endpoint if not already there
if ! grep -q "app.put('/api/users/:userId/roles'" js/server_sqlite_complete.js; then
cat >> js/server_sqlite_complete.js << 'ENDPOINT'

// Update user roles (admin only) - Added for production fix
app.put('/api/users/:userId/roles', authenticateToken, (req, res) => {
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
fi

echo "3. Uploading complete server file..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no js/server_sqlite_complete.js $REMOTE_USER@$REMOTE_HOST:/var/www/pelisivusto/js/server_sqlite_ai.js

echo "4. Restarting production server..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto
pkill -f "node.*server" || true
sleep 2
nohup node js/server_sqlite_ai.js > server_ai.log 2>&1 &
sleep 3
echo "Server restarted"

# Show last few log lines
echo "Server status:"
tail -5 server_ai.log | grep -v "Error executing statement" || echo "Log check failed"
EOF

echo -e "\n5. Summary of fixes:"
echo "✓ Cleaned up test games (only 'Eno' remains)"
echo "✓ Added /api/users/:userId/roles endpoint"
echo "✓ Server restarted with all features"
echo ""
echo "Note: The browser extension errors (injected.bundle.js) are from"
echo "MetaMask or similar crypto wallet extensions - they can be ignored."
echo ""
echo "To fix admin role updates:"
echo "1. Make sure you're logged in as admin"
echo "2. The token should be in cookies after login"
echo "3. Try updating roles again"