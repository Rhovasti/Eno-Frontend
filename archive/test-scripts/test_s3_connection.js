require('dotenv').config();
const AWS = require('aws-sdk');

// Configure AWS
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

console.log('Testing S3 connection...');
console.log('Bucket:', process.env.AWS_BUCKET_NAME);
console.log('Region:', process.env.AWS_REGION);

// Test 1: List buckets
s3.listBuckets((err, data) => {
    if (err) {
        console.error('❌ Error listing buckets:', err);
        return;
    }
    console.log('✅ Connected to AWS S3');
    console.log('Available buckets:', data.Buckets.map(b => b.Name));
});

// Test 2: Check specific bucket
s3.headBucket({ Bucket: process.env.AWS_BUCKET_NAME }, (err, data) => {
    if (err) {
        console.error('❌ Error accessing bucket:', err);
        return;
    }
    console.log('✅ Bucket accessible:', process.env.AWS_BUCKET_NAME);
});

// Test 3: List objects in bucket
s3.listObjectsV2({ 
    Bucket: process.env.AWS_BUCKET_NAME,
    MaxKeys: 5 
}, (err, data) => {
    if (err) {
        console.error('❌ Error listing objects:', err);
        return;
    }
    console.log('✅ Bucket contents:');
    if (data.Contents.length === 0) {
        console.log('  (bucket is empty)');
    } else {
        data.Contents.forEach(obj => {
            console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
        });
    }
});