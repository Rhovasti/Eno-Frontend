const https = require('https');

const API_KEY = 'sk-F8gtGhFo0x6LrWHlxFA5siNjWXKkqZbIPE5j0zqQJOUsVik1';

// Test 1: Get account info / list models
function testAccountInfo() {
    return new Promise((resolve) => {
        console.log('\n🔍 Testing account/user endpoint...');
        
        const options = {
            hostname: 'api.stability.ai',
            path: '/v1/user/account',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json'
            }
        };

        https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log('Response:', data);
                resolve();
            });
        }).on('error', err => {
            console.log('Error:', err.message);
            resolve();
        }).end();
    });
}

// Test 2: List engines/models
function testListEngines() {
    return new Promise((resolve) => {
        console.log('\n🔍 Testing engines list endpoint...');
        
        const options = {
            hostname: 'api.stability.ai',
            path: '/v1/engines/list',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json'
            }
        };

        https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Status: ${res.statusCode}`);
                console.log('Response:', data.substring(0, 1000));
                resolve();
            });
        }).on('error', err => {
            console.log('Error:', err.message);
            resolve();
        }).end();
    });
}

async function main() {
    await testAccountInfo();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testListEngines();
}

main();
