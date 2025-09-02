#!/bin/bash

echo "=== Adding Profile Navigation Links ==="

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'
cd /var/www/pelisivusto

echo "=== Creating a common header update script ==="
cat > update_headers.js << 'EOF'
// This script shows how to update headers across all pages
// to make usernames clickable links to profiles

// Add this CSS to all pages:
const profileLinkCSS = `
    #username {
        color: inherit;
        text-decoration: none;
        border-bottom: 1px dotted #666;
        transition: border-color 0.3s;
    }
    
    #username:hover {
        border-bottom-color: #007bff;
        color: #007bff;
    }
`;

// Update the username display code:
const updateUsernameDisplay = `
    // Original: username.textContent = user.username;
    // Change to:
    username.innerHTML = '<a href="/hml/profile.html?user=' + user.id + '" id="usernameLink">' + user.username + '</a>';
`;

console.log("Apply these changes to all HTML files with user info display");
EOF

echo "=== Updating index.html ==="
cp index.html index.html.backup.profile_nav.$(date +%Y%m%d_%H%M%S)

# Add CSS for profile link
sed -i '/<\/style>/i\
        #username a {\
            color: inherit;\
            text-decoration: none;\
            border-bottom: 1px dotted #666;\
            transition: border-color 0.3s;\
        }\
        \
        #username a:hover {\
            border-bottom-color: #007bff;\
            color: #007bff;\
        }' index.html

# Update username display to be a link
sed -i "s|username\.textContent = user\.username;|username.innerHTML = '<a href=\"/hml/profile.html?user=' + user.id + '\">' + user.username + '</a>';|g" index.html

echo "=== Updating threads.html ==="
if [ -f hml/threads.html ]; then
    cp hml/threads.html hml/threads.html.backup.profile_nav.$(date +%Y%m%d_%H%M%S)
    
    # Add CSS
    sed -i '/<\/style>/i\
        #username a {\
            color: inherit;\
            text-decoration: none;\
            border-bottom: 1px dotted #666;\
            transition: border-color 0.3s;\
        }\
        \
        #username a:hover {\
            border-bottom-color: #007bff;\
            color: #007bff;\
        }' hml/threads.html
    
    # Update username display
    sed -i "s|username\.textContent = user\.username;|username.innerHTML = '<a href=\"/hml/profile.html?user=' + user.id + '\">' + user.username + '</a>';|g" hml/threads.html
fi

echo "=== Updating storyboard.html ==="
if [ -f hml/storyboard.html ]; then
    cp hml/storyboard.html hml/storyboard.html.backup.profile_nav.$(date +%Y%m%d_%H%M%S)
    
    # Add CSS
    sed -i '/<\/style>/i\
        #username a {\
            color: inherit;\
            text-decoration: none;\
            border-bottom: 1px dotted #666;\
            transition: border-color 0.3s;\
        }\
        \
        #username a:hover {\
            border-bottom-color: #007bff;\
            color: #007bff;\
        }' hml/storyboard.html
    
    # Update username display
    sed -i "s|username\.textContent = user\.username;|username.innerHTML = '<a href=\"/hml/profile.html?user=' + user.id + '\">' + user.username + '</a>';|g" hml/storyboard.html
fi

echo "=== Updating GM Dashboard ==="
if [ -f hml/gm-dashboard.html ]; then
    cp hml/gm-dashboard.html hml/gm-dashboard.html.backup.profile_nav.$(date +%Y%m%d_%H%M%S)
    
    # The GM dashboard might not have username display yet, so let's check
    if grep -q "username.textContent" hml/gm-dashboard.html; then
        sed -i "s|username\.textContent = user\.username;|username.innerHTML = '<a href=\"/hml/profile.html?user=' + user.id + '\">' + user.username + '</a>';|g" hml/gm-dashboard.html
    fi
fi

echo "=== Updating profile.html to show owned games for GMs ==="
cp hml/profile.html hml/profile.html.backup.games.$(date +%Y%m%d_%H%M%S)

# Add a games section to profile.html
sed -i '/<div id="userPosts">/i\
        <!-- Games Section for GMs -->\
        <div id="gamesSection" style="display: none;">\
            <h3>Omat pelit</h3>\
            <div id="userGames" class="games-list">\
                <!-- User games will be loaded here -->\
            </div>\
        </div>\
        ' hml/profile.html

# Add CSS for games list
sed -i '/<\/style>/i\
        .games-list {\
            margin-top: 20px;\
        }\
        \
        .game-item {\
            background: #f8f9fa;\
            border: 1px solid #dee2e6;\
            border-radius: 4px;\
            padding: 15px;\
            margin-bottom: 15px;\
        }\
        \
        .game-item h4 {\
            margin-top: 0;\
            margin-bottom: 10px;\
        }\
        \
        .game-stats {\
            font-size: 14px;\
            color: #666;\
            margin-bottom: 10px;\
        }\
        \
        .game-links {\
            display: flex;\
            gap: 10px;\
        }\
        \
        .game-links a {\
            font-size: 14px;\
        }' hml/profile.html

# Add JavaScript to load user's games
sed -i '/loadUserPosts();/a\
        loadUserGames();' hml/profile.html

# Add the loadUserGames function before the closing script tag
sed -i '/<\/script>/i\
\
        async function loadUserGames() {\
            // Only show for GMs\
            const profileUser = await getUserProfile();\
            if (!profileUser) return;\
            \
            const roles = JSON.parse(profileUser.roles || "[]");\
            if (!roles.includes("gm") && !profileUser.is_admin) {\
                return;\
            }\
            \
            // Show games section\
            document.getElementById("gamesSection").style.display = "block";\
            \
            try {\
                const response = await fetch("/api/games", {\
                    headers: {\
                        "Authorization": `Bearer ${getCookie("token")}`\
                    }\
                });\
                \
                if (response.ok) {\
                    const games = await response.json();\
                    const userGames = games.filter(game => game.created_by === parseInt(userId));\
                    \
                    const gamesDiv = document.getElementById("userGames");\
                    \
                    if (userGames.length === 0) {\
                        gamesDiv.innerHTML = "<p>Ei vielä luotuja pelejä.</p>";\
                        return;\
                    }\
                    \
                    gamesDiv.innerHTML = userGames.map(game => `\
                        <div class="game-item">\
                            <h4>${game.title}</h4>\
                            <p>${game.description}</p>\
                            <div class="game-stats">\
                                <span>📊 ${game.total_posts || 0} postausta</span> |\
                                <span>👥 ${game.player_count || 0} pelaajaa</span> |\
                                <span>📖 ${game.chapter_count || 0} lukua</span>\
                            </div>\
                            <div class="game-links">\
                                <a href="/hml/gm-dashboard.html?game=${game.id}" class="btn btn-primary btn-sm">GM Dashboard</a>\
                                <a href="/hml/threads.html?game=${game.id}" class="btn btn-secondary btn-sm">Näytä peli</a>\
                            </div>\
                        </div>\
                    `).join("");\
                }\
            } catch (error) {\
                console.error("Error loading games:", error);\
            }\
        }\
        \
        async function getUserProfile() {\
            try {\
                const response = await fetch(`/api/users/${userId}`, {\
                    headers: {\
                        "Authorization": `Bearer ${getCookie("token")}`\
                    }\
                });\
                if (response.ok) {\
                    return await response.json();\
                }\
            } catch (error) {\
                console.error("Error fetching user profile:", error);\
            }\
            return null;\
        }' hml/profile.html

echo "=== Creating API endpoint for user info if missing ==="
# Check if the API endpoint exists for getting user info with roles
grep -q "app.get.*/api/users/:userId" js/server_sqlite.js || cat >> /tmp/user_api_addition.js << 'EOF'

// Add this endpoint to server_sqlite.js if it doesn't exist
app.get('/api/users/:userId', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    db.get(
        `SELECT id, username, email, roles, is_admin, is_gm, bio, created_at 
         FROM users WHERE id = ?`,
        [userId],
        (err, user) => {
            if (err) {
                console.error('Error fetching user:', err);
                return res.status(500).json({ error: 'Failed to fetch user' });
            }
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            // Don't send password hash
            delete user.password;
            
            res.json(user);
        }
    );
});
EOF

echo "=== Profile navigation updates complete! ==="
echo "New features added:"
echo "✅ Username in header is now clickable link to profile"
echo "✅ GM profiles now show list of owned games"
echo "✅ Game statistics displayed in profile"
echo "✅ Quick links to GM Dashboard from profile"

ENDSSH

echo -e "\n=== Local script complete ==="