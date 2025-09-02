const BASE_URL = 'https://www.iinou.eu';

async function testAIGMComplete() {
    const fetch = (await import('node-fetch')).default;
    console.log('Testing Complete AI GM Flow...\n');

    // Test creating an AI GM game and check for intro message
    console.log('1. Creating AI GM game request...');
    
    const gameRequest = {
        gm_profile_id: 1, // Klassinen Tarinankertoja
        game_title: `AI Test Game ${Date.now()}`,
        genre: 'fantasy',
        description: 'Testing AI GM intro message generation',
        preferences: {
            theme: 'epic quest',
            difficulty: 'medium'
        }
    };
    
    try {
        const createResponse = await fetch(`${BASE_URL}/api/ai-gm-games`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gameRequest)
        });
        
        const responseText = await createResponse.text();
        console.log('Response status:', createResponse.status);
        console.log('Response:', responseText);
        
        if (createResponse.ok) {
            const result = JSON.parse(responseText);
            const { gameId, introMessageId } = result;
            console.log(`✓ Game created with ID: ${gameId}`);
            
            if (introMessageId) {
                console.log(`✓ Intro message created with ID: ${introMessageId}`);
                
                // Wait a moment then check for the intro message
                console.log('\n2. Checking for intro message...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const postsResponse = await fetch(`${BASE_URL}/api/games/${gameId}/posts`);
                if (postsResponse.ok) {
                    const posts = await postsResponse.json();
                    const introPost = posts.find(p => p.id === introMessageId);
                    
                    if (introPost) {
                        console.log('✓ Intro message found:');
                        console.log(`  Author: ${introPost.username}`);
                        console.log(`  Content preview: ${introPost.content.substring(0, 150)}...`);
                        console.log(`  Full length: ${introPost.content.length} characters`);
                    } else {
                        console.log('✗ Intro message not found in posts');
                    }
                } else {
                    console.log('✗ Could not retrieve posts');
                }
            } else {
                console.log('✗ No intro message ID returned');
            }
        } else {
            console.log('✗ Game creation failed');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testAIGMComplete().catch(console.error);