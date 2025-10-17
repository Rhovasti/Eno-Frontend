/**
 * Test script to find the correct Stability AI Stable Audio endpoint
 */

const https = require('https');
const FormData = require('form-data');

const STABILITY_API_KEY = 'sk-F8gtGhFo0x6LrWHlxFA5siNjWXKkqZbIPE5j0zqQJOUsVik1';

// Possible endpoints to test
const possibleEndpoints = [
    '/v2beta/stable-audio/generate/audio',
    '/v2beta/stable-audio/generate',
    '/v1/generation/stable-audio/text-to-audio',
    '/v1/stable-audio/generate'
];

async function testEndpoint(path) {
    return new Promise((resolve) => {
        console.log(`\nTesting endpoint: ${path}`);

        const form = new FormData();
        form.append('prompt', 'A short test sound');
        form.append('duration', '5');

        const requestOptions = {
            hostname: 'api.stability.ai',
            path: path,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
                'Accept': 'audio/*',
                ...form.getHeaders()
            }
        };

        const req = https.request(requestOptions, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, res.headers);

            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✅ SUCCESS! Working endpoint: ${path}`);
                    console.log(`Response type: ${res.headers['content-type']}`);
                } else if (res.statusCode === 404) {
                    console.log(`❌ Not found (404)`);
                } else if (res.statusCode === 400) {
                    console.log(`⚠️  Bad request (400) - endpoint exists but parameters wrong`);
                    console.log(`Response:`, data.substring(0, 500));
                } else {
                    console.log(`Response:`, data.substring(0, 500));
                }
                resolve({ path, statusCode: res.statusCode, data });
            });
        });

        req.on('error', (error) => {
            console.log(`❌ Error: ${error.message}`);
            resolve({ path, error: error.message });
        });

        form.pipe(req);
    });
}

async function main() {
    console.log('🔍 Testing Stability AI Stable Audio endpoints...\n');
    console.log('Using API key:', STABILITY_API_KEY.substring(0, 20) + '...');

    for (const endpoint of possibleEndpoints) {
        await testEndpoint(endpoint);
        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ Test complete!');
}

main().catch(console.error);
