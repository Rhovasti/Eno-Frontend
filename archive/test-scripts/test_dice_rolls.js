const fetch = require('node-fetch');
const { spawn } = require('child_process');

const BASE_URL = 'http://localhost:3001';
let server;

// Test user credentials
const testGM = {
    email: 'testgm@example.com',
    password: 'password123'
};

const testPlayer = {
    email: 'testplayer@example.com',
    password: 'password123'
};

async function startServer() {
    console.log('Starting server...');
    server = spawn('node', ['js/server_sqlite.js'], {
        cwd: __dirname,
        detached: true
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
}

async function stopServer() {
    if (server) {
        console.log('Stopping server...');
        process.kill(-server.pid);
    }
}

async function login(email, password) {
    const response = await fetch(`${BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.token;
}

async function createTestUsers() {
    console.log('Creating test users...');
    
    // Create GM user
    try {
        await fetch(`${BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'testgm',
                email: testGM.email,
                password: testGM.password,
                roles: ['gm', 'player']
            })
        });
    } catch (e) {
        console.log('GM user may already exist');
    }
    
    // Create Player user
    try {
        await fetch(`${BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'testplayer',
                email: testPlayer.email,
                password: testPlayer.password,
                roles: ['player']
            })
        });
    } catch (e) {
        console.log('Player user may already exist');
    }
}

async function testDiceRolls() {
    console.log('\n=== Testing Dice Roll Feature ===\n');
    
    // Login as GM
    console.log('1. Logging in as GM...');
    const gmToken = await login(testGM.email, testGM.password);
    console.log('✓ GM logged in successfully');
    
    // Create a test game
    console.log('\n2. Creating test game...');
    const gameResponse = await fetch(`${BASE_URL}/api/games`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gmToken}`
        },
        body: JSON.stringify({
            title: 'Dice Roll Test Game',
            description: 'Testing dice roll functionality',
            genre: 'fantasy'
        })
    });
    
    const game = await gameResponse.json();
    console.log('✓ Game created:', game.id);
    
    // Get the first chapter and beat
    console.log('\n3. Getting game structure...');
    const chaptersResponse = await fetch(`${BASE_URL}/api/games/${game.id}/chapters`, {
        headers: { 'Authorization': `Bearer ${gmToken}` }
    });
    const chapters = await chaptersResponse.json();
    const chapter = chapters[0];
    
    const beatsResponse = await fetch(`${BASE_URL}/api/chapters/${chapter.id}/beats`, {
        headers: { 'Authorization': `Bearer ${gmToken}` }
    });
    const beats = await beatsResponse.json();
    const beat = beats[0];
    console.log('✓ Found beat:', beat.id);
    
    // Test GM dice roll
    console.log('\n4. Testing GM dice roll (2d6+3)...');
    const gmPostResponse = await fetch(`${BASE_URL}/api/beats/${beat.id}/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gmToken}`
        },
        body: JSON.stringify({
            title: 'GM Attack Roll',
            content: 'The orc swings his mighty axe at the adventurer!',
            diceRoll: {
                notation: '2d6+3',
                rolls: [4, 5],
                modifier: 3,
                total: 12,
                purpose: 'Orc Attack'
            }
        })
    });
    
    if (!gmPostResponse.ok) {
        console.error('GM post failed:', await gmPostResponse.text());
    } else {
        console.log('✓ GM post with dice roll created');
    }
    
    // Login as player
    console.log('\n5. Logging in as player...');
    const playerToken = await login(testPlayer.email, testPlayer.password);
    console.log('✓ Player logged in successfully');
    
    // Test player dice roll
    console.log('\n6. Testing player dice roll (1d20+5)...');
    const playerPostResponse = await fetch(`${BASE_URL}/api/beats/${beat.id}/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${playerToken}`
        },
        body: JSON.stringify({
            title: 'Player Defense Roll',
            content: 'I attempt to dodge the orc\'s attack!',
            diceRoll: {
                notation: '1d20+5',
                rolls: [15],
                modifier: 5,
                total: 20,
                purpose: 'Dodge'
            }
        })
    });
    
    if (!playerPostResponse.ok) {
        console.error('Player post failed:', await playerPostResponse.text());
    } else {
        console.log('✓ Player post with dice roll created');
    }
    
    // Verify dice rolls are included in beat data
    console.log('\n7. Verifying dice rolls in beat data...');
    const verifyResponse = await fetch(`${BASE_URL}/api/chapters/${chapter.id}/beats`, {
        headers: { 'Authorization': `Bearer ${gmToken}` }
    });
    const verifyBeats = await verifyResponse.json();
    const verifyBeat = verifyBeats.find(b => b.id === beat.id);
    
    let diceRollsFound = 0;
    verifyBeat.posts.forEach(post => {
        if (post.diceRoll) {
            diceRollsFound++;
            console.log(`✓ Found dice roll in post "${post.title}": ${post.diceRoll.notation} = ${post.diceRoll.total}`);
        }
    });
    
    if (diceRollsFound === 2) {
        console.log('\n✅ All dice roll tests passed!');
    } else {
        console.log(`\n❌ Expected 2 dice rolls, found ${diceRollsFound}`);
    }
}

// Run tests
(async () => {
    try {
        await startServer();
        await createTestUsers();
        await testDiceRolls();
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await stopServer();
        process.exit();
    }
})();