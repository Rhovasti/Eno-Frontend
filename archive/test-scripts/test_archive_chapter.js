const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';

// Test archiving chapter functionality
async function testArchiveChapter() {
    try {
        // First, login as admin
        const loginResponse = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@example.com',
                password: 'admin123'
            })
        });
        
        const loginData = await loginResponse.json();
        const token = loginData.token;
        
        console.log('Login successful, token:', token ? 'received' : 'not received');
        
        // Create a test post with archiveChapter flag
        console.log('\nTesting post creation with archiveChapter flag...');
        
        const postResponse = await fetch(`${API_URL}/api/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                beatId: 1, // Assuming beat ID 1 exists
                title: 'Test Post with Archive',
                content: 'This post should archive the chapter',
                postType: 'gm',
                archiveChapter: true
            })
        });
        
        if (postResponse.ok) {
            const postData = await postResponse.json();
            console.log('Post created successfully:', postData);
        } else {
            const error = await postResponse.json();
            console.error('Error creating post:', error);
        }
        
        // Test the direct archive endpoint
        console.log('\nTesting direct archive endpoint...');
        
        const archiveResponse = await fetch(`${API_URL}/api/chapters/1/archive`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                archived_narrative: 'This chapter was archived as a test'
            })
        });
        
        if (archiveResponse.ok) {
            const archiveData = await archiveResponse.json();
            console.log('Chapter archived successfully:', archiveData);
        } else {
            const error = await archiveResponse.json();
            console.error('Error archiving chapter:', error);
        }
        
        // Fetch chapters to see archived status
        console.log('\nFetching chapters to verify archive status...');
        
        const chaptersResponse = await fetch(`${API_URL}/api/games/1/chapters`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (chaptersResponse.ok) {
            const chapters = await chaptersResponse.json();
            console.log('Chapters:', chapters);
        } else {
            const error = await chaptersResponse.json();
            console.error('Error fetching chapters:', error);
        }
        
    } catch (error) {
        console.error('Test error:', error);
    }
}

// Run the test
testArchiveChapter();