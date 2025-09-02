// Test script for AI chapter generation
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';
const TEST_TOKEN = 'test-token'; // You'll need a real token from login

async function testAIChapterGeneration() {
    console.log('Testing AI Chapter Generation...\n');
    
    // Test data
    const testGame = {
        gameId: 'test-123',
        gameName: 'The Lost Kingdom',
        gameDescription: 'A fantasy adventure where heroes must save a kingdom from an ancient evil that has awakened.',
        genre: 'fantasy'
    };
    
    try {
        // Test first chapter generation
        console.log('1. Testing first chapter generation:');
        const chapterResponse = await fetch(`${API_URL}/api/ai/generate-first-chapter`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_TOKEN}`
            },
            body: JSON.stringify(testGame)
        });
        
        if (chapterResponse.ok) {
            const chapter = await chapterResponse.json();
            console.log('✓ Chapter generated successfully:');
            console.log(`  Title: ${chapter.title}`);
            console.log(`  Description: ${chapter.description.substring(0, 100)}...`);
            console.log(`  Tokens used: ${chapter.tokens_used}`);
        } else {
            const error = await chapterResponse.json();
            console.log('✗ Chapter generation failed:', error);
        }
        
        console.log('\n2. Testing story arc generation:');
        const storyArcResponse = await fetch(`${API_URL}/api/ai/generate-story-arc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TEST_TOKEN}`
            },
            body: JSON.stringify({
                ...testGame,
                numberOfChapters: 5
            })
        });
        
        if (storyArcResponse.ok) {
            const storyArc = await storyArcResponse.json();
            console.log('✓ Story arc generated successfully:');
            console.log(`  Number of chapters: ${storyArc.chapters.length}`);
            storyArc.chapters.forEach((chapter, index) => {
                console.log(`  Chapter ${index + 1}: ${chapter.title}`);
            });
            console.log(`  Tokens used: ${storyArc.tokens_used}`);
        } else {
            const error = await storyArcResponse.json();
            console.log('✗ Story arc generation failed:', error);
        }
        
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

// Instructions
console.log('AI Chapter Generation Test Script');
console.log('================================\n');
console.log('Prerequisites:');
console.log('1. Start the AI-enhanced server: node js/server_sqlite_ai_extended.js');
console.log('2. Set AI_API_KEY in .env file');
console.log('3. Get a valid auth token by logging in as a GM user');
console.log('4. Update TEST_TOKEN in this script\n');
console.log('To run: node test_ai_chapters.js\n');

// Uncomment to run the test
// testAIChapterGeneration();