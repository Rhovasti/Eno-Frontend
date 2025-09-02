// Test AI GM initial post creation
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = 'http://localhost:3000';

async function loginAndTestAIGM() {
    try {
        // Login as testuser
        console.log('1. Logging in as testuser...');
        const loginResponse = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'testuser',
                password: 'testpass123'
            })
        });
        
        const loginData = await loginResponse.json();
        console.log('Login response:', loginData);
        
        if (!loginData.token) {
            throw new Error('No token received');
        }
        
        const token = loginData.token;
        
        // Get AI GM profiles
        console.log('\n2. Getting AI GM profiles...');
        const profilesResponse = await fetch(`${API_URL}/api/ai-gm-profiles`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const profiles = await profilesResponse.json();
        console.log('Available AI GM profiles:', profiles.map(p => ({ id: p.id, name: p.name })));
        
        if (profiles.length === 0) {
            throw new Error('No AI GM profiles available');
        }
        
        // Create a game with AI GM
        console.log('\n3. Creating game with AI GM...');
        const gameData = {
            player_id: loginData.user.id,
            ai_gm_profile_id: profiles[0].id,
            game_title: `Test AI Game ${Date.now()}`,
            game_description: 'Tämä on testipeli AI GM:n kanssa. Pelaajat tutkivat mystistä linnaa.',
            genre: 'fantasy',
            theme: 'mysteeri',
            max_players: 4
        };
        
        const createGameResponse = await fetch(`${API_URL}/api/player-game-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(gameData)
        });
        
        const gameResult = await createGameResponse.json();
        console.log('Game creation result:', gameResult);
        
        if (!gameResult.game_id) {
            throw new Error('No game ID returned');
        }
        
        // Wait a bit for AI to generate initial post
        console.log('\n4. Waiting for AI to generate initial post...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get the game's chapters
        console.log('\n5. Getting chapters...');
        const chaptersResponse = await fetch(`${API_URL}/api/games/${gameResult.game_id}/chapters`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const chapters = await chaptersResponse.json();
        console.log('Chapters:', chapters);
        
        if (chapters.length === 0) {
            throw new Error('No chapters found');
        }
        
        // Get the first chapter's beats
        console.log('\n6. Getting beats...');
        const beatsResponse = await fetch(`${API_URL}/api/chapters/${chapters[0].id}/beats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const beats = await beatsResponse.json();
        console.log('Beats:', beats.map(b => ({ id: b.id, title: b.title, posts: b.posts?.length || 0 })));
        
        if (beats.length === 0) {
            throw new Error('No beats found');
        }
        
        // Check posts in the first beat
        const firstBeat = beats[0];
        console.log('\n7. Posts in first beat:');
        if (firstBeat.posts && firstBeat.posts.length > 0) {
            firstBeat.posts.forEach(post => {
                console.log(`\n--- Post ${post.id} ---`);
                console.log(`Title: ${post.title}`);
                console.log(`Author: ${post.username || 'Unknown'} (ID: ${post.author_id})`);
                console.log(`Type: ${post.post_type}`);
                console.log(`Content: ${post.content?.substring(0, 200)}...`);
                console.log(`Created: ${post.created_at}`);
            });
        } else {
            console.log('No posts found in the first beat!');
        }
        
        console.log('\n✅ Test completed!');
        
    } catch (error) {
        console.error('Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

loginAndTestAIGM();