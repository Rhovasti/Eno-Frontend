#!/bin/bash

echo "Adding debug logging to threads.js..."

# Create a fixed version with better logging
cat > /tmp/threads_debug.js << 'EOF'
// Add this to the loadBeats function (around line 495)
function loadBeats(chapterId) {
    console.log('Loading beats for chapter:', chapterId);
    
    fetch(`/api/chapters/${chapterId}/beats`, {
        headers: {
            'Authorization': `Bearer ${getCookie('token')}`
        }
    })
    .then(response => {
        console.log('Beats response status:', response.status);
        if (!response.ok) {
            throw new Error('Failed to fetch beats');
        }
        return response.json();
    })
    .then(beats => {
        console.log('Beats received:', beats);
        
        // Clear and populate beat select
        beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
        
        if (!beats || beats.length === 0) {
            console.warn('No beats found for chapter', chapterId);
            beatSelect.innerHTML = '<option value="">Ei beatteja tässä luvussa</option>';
            beatSelect.disabled = true;
            createBeatButton.disabled = !isGM;
            return;
        }
        
        // Sort beats by sequence number
        beats
            .sort((a, b) => a.sequence_number - b.sequence_number)
            .forEach(beat => {
                const option = document.createElement('option');
                option.value = beat.id;
                option.textContent = beat.title || `Beatti ${beat.sequence_number}`;
                beatSelect.appendChild(option);
            });
        
        beatSelect.disabled = false;
        createBeatButton.disabled = !isGM;
        console.log('Beat select populated with', beats.length, 'beats');
    })
    .catch(error => {
        console.error('Error fetching beats:', error);
        beatSelect.innerHTML = '<option value="">Virhe beattien latauksessa</option>';
        beatSelect.disabled = true;
    });
}
EOF

echo "Deploying debug version to production..."

# Upload the fix
sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'REMOTE_CMD'
cd /var/www/pelisivusto

# Backup current file
cp js/threads.js js/threads.js.backup

# Add debug logging to the existing file
sed -i '/function loadBeats(chapterId) {/a\    console.log("Loading beats for chapter:", chapterId);' js/threads.js
sed -i '/\.then(response => {/a\        console.log("Beats response status:", response.status);' js/threads.js
sed -i '/\.then(beats => {/a\        console.log("Beats received:", beats);' js/threads.js
sed -i '/beatSelect.disabled = false;/a\        console.log("Beat select populated with", beats.length, "beats");' js/threads.js

echo "Debug logging added to threads.js"
REMOTE_CMD

echo "Fix deployed! Users should now see console logs when selecting chapters."
echo "To check the logs, open browser DevTools (F12) and look at the Console tab."