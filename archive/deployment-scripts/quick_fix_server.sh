#!/bin/bash

REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

# Create a patch for the profile endpoints
cat > /tmp/profile_endpoints.txt << 'EOF'

// Get user profile
app.get('/api/users/:userId/profile', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    // For SQLite, we need a simpler query
    const query = `
        SELECT 
            u.id, 
            u.username, 
            u.email,
            u.roles,
            u.is_admin,
            u.created_at,
            u.bio
        FROM users u
        WHERE u.id = ?
    `;
    
    db.get(query, [userId], (err, profile) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!profile) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Don't send email unless it's the user's own profile or admin
        if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
            delete profile.email;
        }
        
        // Get game and post counts separately
        db.get('SELECT COUNT(*) as game_count FROM games WHERE gm_id = ? OR player_ids LIKE ?', 
            [userId, '%"' + userId + '"%'], (err, gameStats) => {
            db.get('SELECT COUNT(*) as post_count FROM posts WHERE author_id = ?', 
                [userId], (err, postStats) => {
                profile.game_count = gameStats ? gameStats.game_count : 0;
                profile.post_count = postStats ? postStats.post_count : 0;
                res.json(profile);
            });
        });
    });
});

// Update user profile
app.put('/api/users/:userId/profile', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { bio, displayName } = req.body;
    const updates = [];
    const values = [];
    
    if (bio !== undefined) {
        updates.push('bio = ?');
        values.push(bio);
    }
    
    if (displayName !== undefined) {
        updates.push('username = ?');
        values.push(displayName);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }
    
    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(query, values, function(err) {
        if (err) {
            console.error('Error updating profile:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'Profile updated successfully' });
    });
});

// Get user's recent posts
app.get('/api/users/:userId/posts', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 10;
    
    const query = `
        SELECT 
            p.id,
            p.title,
            p.content,
            p.created_at,
            p.post_type,
            b.id as beat_id,
            b.title as beat_title,
            c.id as chapter_id,
            c.title as chapter_title,
            g.id as game_id,
            g.name as game_name
        FROM posts p
        JOIN beats b ON p.beat_id = b.id
        JOIN chapters c ON b.chapter_id = c.id
        JOIN games g ON c.game_id = g.id
        WHERE p.author_id = ?
        ORDER BY p.created_at DESC
        LIMIT ?
    `;
    
    db.all(query, [userId, limit], (err, results) => {
        if (err) {
            console.error('Error fetching user posts:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(results);
    });
});

// Change password
app.put('/api/users/:userId/password', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
    
    if (req.user.id !== parseInt(userId)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current and new passwords are required' });
    }
    
    db.get('SELECT password FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) {
            console.error('Error verifying password:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId], (err) => {
            if (err) {
                console.error('Error updating password:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ message: 'Password updated successfully' });
        });
    });
});

EOF

echo "Patch created. Now applying to production..."

# Apply the patch by SSH
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'
cd /var/www/pelisivusto

# First, restore from the original backup if it exists
if [ -f js/server_original.js ]; then
    cp js/server_original.js js/server_sqlite_new.js
else
    echo "Warning: No backup found, working with current file"
fi

# Add the profile endpoints before the last few lines of the file
# Find the line with "Start the server" and insert before it
LINE_NUM=$(grep -n "Start the server" js/server_sqlite_new.js | cut -d: -f1)
if [ -z "$LINE_NUM" ]; then
    # If not found, try to find app.listen
    LINE_NUM=$(grep -n "app.listen" js/server_sqlite_new.js | cut -d: -f1)
fi

if [ ! -z "$LINE_NUM" ]; then
    # Insert the endpoints before the server start
    head -n $((LINE_NUM - 2)) js/server_sqlite_new.js > /tmp/server_new.js
    cat /tmp/profile_endpoints.txt >> /tmp/server_new.js
    tail -n +$((LINE_NUM - 1)) js/server_sqlite_new.js >> /tmp/server_new.js
    mv /tmp/server_new.js js/server_sqlite_new.js
    echo "Profile endpoints added successfully"
else
    echo "Could not find insertion point, appending to end"
    cat /tmp/profile_endpoints.txt >> js/server_sqlite_new.js
fi

# Restart the server
pkill -f "node.*server" || true
sleep 2
nohup node js/server_sqlite_new.js > server.log 2>&1 &
sleep 3

# Check if server started
if pgrep -f "node.*server" > /dev/null; then
    echo "Server restarted successfully"
    tail -5 server.log
else
    echo "Server failed to start"
    tail -20 server.log
fi

ENDSSH

# Upload the patch file too
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no /tmp/profile_endpoints.txt $REMOTE_USER@$REMOTE_HOST:/tmp/

echo "Quick fix completed"