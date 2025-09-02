const BASE_URL = 'http://95.217.21.111:3001';

async function testBeatsCreation() {
    const fetch = (await import('node-fetch')).default;
    console.log('Testing Beats Creation...\n');

    // Use existing test user
    console.log('1. Logging in with test user...');
    const loginResponse = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'admin',
            password: 'admin'
        })
    });
    
    if (!loginResponse.ok) {
        console.error('Login failed:', await loginResponse.text());
        return;
    }
    
    const { token } = await loginResponse.json();
    console.log('✓ Logged in successfully\n');

    // Create a regular game (not AI GM)
    console.log('2. Creating regular game...');
    const gameData = {
        title: `Test Game ${Date.now()}`,
        description: 'A test game to check beats creation',
        genre: 'fantasy'
    };
    
    const createGameResponse = await fetch(`${BASE_URL}/api/games`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(gameData)
    });
    
    if (!createGameResponse.ok) {
        console.error('Game creation failed:', await createGameResponse.text());
        return;
    }
    
    const { gameId } = await createGameResponse.json();
    console.log(`✓ Game created with ID: ${gameId}\n`);

    // Check if chapters and beats were created
    console.log('3. Checking database state...');
    const gamesResponse = await fetch(`${BASE_URL}/api/games/${gameId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (gamesResponse.ok) {
        const game = await gamesResponse.json();
        console.log(`✓ Game retrieved: ${game.title}`);
    }

    const chaptersResponse = await fetch(`${BASE_URL}/api/games/${gameId}/chapters`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (chaptersResponse.ok) {
        const chapters = await chaptersResponse.json();
        console.log(`✓ Chapters found: ${chapters.length}`);
        
        if (chapters.length > 0) {
            const beatsResponse = await fetch(`${BASE_URL}/api/games/${gameId}/chapters/${chapters[0].id}/beats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (beatsResponse.ok) {
                const beats = await beatsResponse.json();
                console.log(`✓ Beats found in first chapter: ${beats.length}`);
                
                if (beats.length === 0) {
                    console.log('⚠️  No beats created - this explains why AI can\'t post!');
                } else {
                    console.log('✓ Beats exist - AI should be able to post');
                }
            } else {
                console.log('✗ Could not retrieve beats');
            }
        }
    } else {
        console.log('✗ Could not retrieve chapters');
    }
}

testBeatsCreation().catch(console.error);