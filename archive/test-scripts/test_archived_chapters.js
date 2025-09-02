const http = require('http');

// Test to check archived chapters functionality
console.log('Testing archived chapters implementation...\n');

// First, login as admin
const loginData = JSON.stringify({
    email: 'admin@example.com',
    password: 'admin123'
});

const loginOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

const loginReq = http.request(loginOptions, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    
    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error('Login failed');
            return;
        }
        
        const loginResponse = JSON.parse(responseData);
        const token = loginResponse.token;
        console.log('✓ Logged in successfully\n');
        
        // Test 1: Get all chapters (including archived)
        const chaptersOptions = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/games/2/chapters',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        };
        
        http.get(chaptersOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const chapters = JSON.parse(data);
                console.log('Chapters in game 2:');
                chapters.forEach(ch => {
                    console.log(`- ${ch.title} (${ch.is_archived ? 'ARCHIVED' : 'ACTIVE'})`);
                });
                console.log('');
                
                // Test 2: Get archived chapters
                const archivedOptions = {
                    hostname: 'localhost',
                    port: 3000,
                    path: '/api/games/2/archived-chapters',
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                };
                
                http.get(archivedOptions, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        const archived = JSON.parse(data);
                        console.log('Archived chapters:');
                        archived.forEach(ch => {
                            console.log(`- ${ch.title} (archived at: ${ch.archived_at})`);
                        });
                        console.log('\n✓ All tests completed!');
                    });
                });
            });
        });
    });
});

loginReq.write(loginData);
loginReq.end();