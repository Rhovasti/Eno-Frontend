require('dotenv').config();
const https = require('https');

console.log('Testing Stability AI connection...');
console.log('API Key:', process.env.STABILITY_API_KEY ? 'Configured' : 'Missing');

// Simple test prompt
const testPrompt = "a simple red circle on white background";

const requestBody = JSON.stringify({
    text_prompts: [
        {
            text: testPrompt,
            weight: 1
        }
    ],
    width: 512,
    height: 512,
    samples: 1,
    steps: 30,
    cfg_scale: 7
});

const options = {
    hostname: 'api.stability.ai',
    path: '/v1/generation/stable-diffusion-v1-6/text-to-image',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
        'Content-Length': Buffer.byteLength(requestBody)
    }
};

const req = https.request(options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let data = '';
    
    res.on('data', (chunk) => {
        data += chunk;
    });
    
    res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const response = JSON.parse(data);
                console.log('✅ Success! Image generated');
                console.log('Artifacts:', response.artifacts.length);
                if (response.artifacts[0]) {
                    console.log('Image size:', response.artifacts[0].base64.length, 'chars');
                }
            } catch (e) {
                console.error('Failed to parse response:', e);
            }
        } else {
            console.error('❌ Error:', res.statusCode);
            console.error('Response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('Request error:', error);
});

req.write(requestBody);
req.end();