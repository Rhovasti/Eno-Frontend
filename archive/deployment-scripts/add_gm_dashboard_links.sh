#!/bin/bash

echo "=== Adding GM Dashboard Links to Existing Pages ==="

# This script adds GM Dashboard links to threads.html and storyboard.html

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'
cd /var/www/pelisivusto

echo "=== Adding GM Dashboard link to threads.html ==="
# Backup threads.html
cp hml/threads.html hml/threads.html.backup.$(date +%Y%m%d_%H%M%S)

# Add GM Dashboard button after the game selector
# This is a simple approach - in production you might want a more sophisticated integration
sed -i '/<div id="gameSelector">/a\        <div id="gmDashboardLink" style="margin-top: 10px; display: none;">\n            <a href="#" id="gmDashboardBtn" class="btn btn-primary">🎮 GM Dashboard</a>\n        </div>' hml/threads.html

# Add JavaScript to show/hide the GM Dashboard link
sed -i '/<\/script>/i\
// Add GM Dashboard link for GMs\n\
const urlParams = new URLSearchParams(window.location.search);\n\
const gameId = urlParams.get("game");\n\
if (gameId) {\n\
    fetch(`/api/games/${gameId}`)\n\
        .then(res => res.json())\n\
        .then(gameData => {\n\
            const user = JSON.parse(localStorage.getItem("user") || "{}");\n\
            if (gameData.created_by === user.id || user.is_admin) {\n\
                document.getElementById("gmDashboardLink").style.display = "block";\n\
                document.getElementById("gmDashboardBtn").href = `/hml/gm-dashboard.html?game=${gameId}`;\n\
            }\n\
        })\n\
        .catch(err => console.error("Error checking game ownership:", err));\n\
}' hml/threads.html

echo "=== Adding quick access from create-game success ==="
# Backup create-game.html
cp hml/create-game.html hml/create-game.html.backup.$(date +%Y%m%d_%H%M%S)

# Modify the success redirect to include GM dashboard option
sed -i 's|window.location.href = `/hml/threads.html?game=${game.id}`;|if (confirm("Peli luotu! Haluatko siirtyä GM Dashboardiin?")) {\n                        window.location.href = `/hml/gm-dashboard.html?game=${game.id}`;\n                    } else {\n                        window.location.href = `/hml/threads.html?game=${game.id}`;\n                    }|' hml/create-game.html

echo "=== Updates complete ==="
echo "GM Dashboard links have been added to:"
echo "- threads.html (visible when viewing a game you created)"
echo "- create-game.html (option to go to dashboard after creating a game)"

ENDSSH

echo -e "\n=== Integration complete ==="