const BASE_URL = 'http://95.217.21.111:3000';

async function testAIGMFeatures() {
    const fetch = (await import('node-fetch')).default;
    console.log('Testing AI GM Features...\n');

    // Test 1: Login as player
    console.log('1. Testing player login...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'testuser',
            password: 'password'
        })
    });
    
    if (!loginResponse.ok) {
        console.error('Login failed:', await loginResponse.text());
        return;
    }
    
    const { token } = await loginResponse.json();
    console.log('✓ Login successful\n');

    // Test 2: Get AI GM profiles
    console.log('2. Testing AI GM profiles...');
    const profilesResponse = await fetch(`${BASE_URL}/api/ai-gm-profiles`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!profilesResponse.ok) {
        console.error('Failed to get profiles:', await profilesResponse.text());
        return;
    }
    
    const profiles = await profilesResponse.json();
    console.log(`✓ Found ${profiles.length} AI GM profiles\n`);

    // Test 3: Create a game request
    console.log('3. Testing game creation with AI GM...');
    const gameRequest = {
        gm_profile_id: profiles[0].id,
        game_title: `Test Game ${Date.now()}`,
        genre: 'fantasy',
        description: 'A test game for AI GM features',
        preferences: {
            theme: 'epic quest',
            difficulty: 'medium'
        }
    };
    
    const createResponse = await fetch(`${BASE_URL}/api/ai-gm-games`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(gameRequest)
    });
    
    if (!createResponse.ok) {
        console.error('Failed to create game:', await createResponse.text());
        return;
    }
    
    const { gameId, introMessageId } = await createResponse.json();
    console.log(`✓ Game created with ID: ${gameId}`);
    console.log(`✓ Intro message created with ID: ${introMessageId}\n`);

    // Test 4: Check if intro message was created
    console.log('4. Checking intro message...');
    const postsResponse = await fetch(`${BASE_URL}/api/games/${gameId}/posts`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!postsResponse.ok) {
        console.error('Failed to get posts:', await postsResponse.text());
        return;
    }
    
    const posts = await postsResponse.json();
    const introPost = posts.find(p => p.id === introMessageId);
    
    if (introPost) {
        console.log('✓ Intro message found:');
        console.log(`  Author: ${introPost.username}`);
        console.log(`  Length: ${introPost.content.length} characters`);
        console.log(`  Preview: ${introPost.content.substring(0, 100)}...`);
    } else {
        console.error('✗ Intro message not found');
    }
    
    console.log('\n5. To test automatic responses:');
    console.log(`   - Go to https://www.iinou.eu/hml/threads.html?game_id=${gameId}`);
    console.log('   - Create a player post');
    console.log('   - Wait 3 seconds for AI GM response');
    console.log('   - Check if AI GM responds with context-aware message');
}

// Run tests
testAIGMFeatures().catch(console.error);