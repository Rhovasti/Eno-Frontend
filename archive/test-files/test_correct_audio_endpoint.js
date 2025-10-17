/**
 * Test the CORRECT Stability AI Stable Audio 2.5 endpoint
 * Path: /v2beta/audio/stable-audio-2/text-to-audio
 */

const https = require('https');
const FormData = require('form-data');
const fs = require('fs');

const STABILITY_API_KEY = 'sk-F8gtGhFo0x6LrWHlxFA5siNjWXKkqZbIPE5j0zqQJOUsVik1';

async function testCorrectEndpoint() {
    return new Promise((resolve, reject) => {
        console.log('\n🎵 Testing CORRECT Stability AI Stable Audio 2.5 endpoint...');
        console.log('Path: /v2beta/audio/stable-audio-2/text-to-audio\n');

        const form = new FormData();
        form.append('prompt', 'A short test melody with peaceful piano');
        form.append('output_format', 'mp3');
        form.append('duration', '20');
        form.append('model', 'stable-audio-2.5');

        const requestOptions = {
            hostname: 'api.stability.ai',
            path: '/v2beta/audio/stable-audio-2/text-to-audio',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
                'Accept': 'audio/*',
                ...form.getHeaders()
            }
        };

        const req = https.request(requestOptions, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Content-Type: ${res.headers['content-type']}`);

            if (res.statusCode === 200) {
                console.log('\n✅ SUCCESS! Endpoint works correctly!\n');

                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    const audioBuffer = Buffer.concat(chunks);
                    const filename = 'test_audio_output.mp3';

                    fs.writeFileSync(filename, audioBuffer);
                    console.log(`✅ Audio saved to: ${filename}`);
                    console.log(`📊 File size: ${audioBuffer.length} bytes`);

                    resolve({ success: true, fileSize: audioBuffer.length });
                });
            } else {
                let errorData = '';
                res.on('data', (chunk) => {
                    errorData += chunk;
                });

                res.on('end', () => {
                    console.log(`❌ Error (${res.statusCode})`);
                    console.log('Response:', errorData);
                    resolve({ success: false, statusCode: res.statusCode, error: errorData });
                });
            }
        });

        req.on('error', (error) => {
            console.log(`❌ Request Error: ${error.message}`);
            reject(error);
        });

        form.pipe(req);
    });
}

async function main() {
    try {
        const result = await testCorrectEndpoint();

        if (result.success) {
            console.log('\n🎉 Stability AI Stable Audio 2.5 is WORKING!');
            console.log('Ready to integrate into audioService.js');
        } else {
            console.log('\n⚠️ Still not working. Need to investigate further.');
        }
    } catch (error) {
        console.error('Fatal error:', error);
    }
}

main();
