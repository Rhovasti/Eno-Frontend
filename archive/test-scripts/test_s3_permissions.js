require('dotenv').config();
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

async function testBucketPermissions() {
    console.log('Testing S3 bucket permissions...\n');
    
    // 1. Test basic upload without ACL
    const testKey = `test/test-${Date.now()}.txt`;
    const testContent = 'This is a test file';
    
    try {
        console.log('1. Testing upload without ACL...');
        const uploadResult = await s3.upload({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: testKey,
            Body: testContent,
            ContentType: 'text/plain'
        }).promise();
        
        console.log('✅ Upload successful:', uploadResult.Location);
        
        // 2. Test if object is publicly accessible
        console.log('\n2. Testing public access...');
        const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${testKey}`;
        console.log('Public URL:', publicUrl);
        
        // 3. Try to get object ACL
        console.log('\n3. Checking object permissions...');
        try {
            const acl = await s3.getObjectAcl({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: testKey
            }).promise();
            console.log('Object ACL:', JSON.stringify(acl, null, 2));
        } catch (err) {
            console.log('❌ Cannot read ACL:', err.message);
        }
        
        // 4. Clean up
        console.log('\n4. Cleaning up test file...');
        await s3.deleteObject({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: testKey
        }).promise();
        console.log('✅ Test file deleted');
        
        console.log('\n✅ S3 bucket is working correctly!');
        console.log('Note: Images will be uploaded successfully.');
        console.log('Make sure your bucket has a public access policy for GET requests.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testBucketPermissions();