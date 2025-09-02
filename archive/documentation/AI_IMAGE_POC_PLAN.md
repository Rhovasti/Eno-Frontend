# Proof of Concept Implementation Plan

## Phase 1: Minimal Viable Feature (1-2 days)

### Goal
Test basic image generation → S3 upload → display pipeline

### Implementation Steps

1. **Environment Setup**
   ```bash
   npm install aws-sdk node-fetch sharp
   ```

2. **Add to .env**
   ```
   # AWS S3
   AWS_ACCESS_KEY_ID=your_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_here
   AWS_BUCKET_NAME=kuvatjakalat
   AWS_REGION=eu-north-1
   
   # AI Service (start with one)
   REPLICATE_API_TOKEN=your_token_here
   # OR
   STABILITY_API_KEY=your_key_here
   ```

3. **Database Migration**
   ```sql
   -- Simplified schema for POC
   CREATE TABLE post_images (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       post_id INTEGER NOT NULL,
       prompt TEXT NOT NULL,
       image_url TEXT NOT NULL,
       thumbnail_url TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
   );
   ```

4. **Basic Backend Service**
   ```javascript
   // services/imageService.js
   class ImageService {
     async generateImage(prompt) {
       // 1. Call AI API
       // 2. Get image URL
       // 3. Download image
       // 4. Upload to S3
       // 5. Return S3 URL
     }
   }
   ```

5. **Simple UI Addition**
   - Add "Generate Image" button to post form
   - Text input for image description
   - Loading spinner during generation
   - Display generated image

### Success Criteria
- [ ] Can generate image from text prompt
- [ ] Image uploads to S3 successfully  
- [ ] Image URL saves to database
- [ ] Image displays in post

## Phase 2: Character Consistency (3-4 days)

### Goal
Add basic character profiles and consistent generation

### Features
1. **Character Profile Creation**
   - Simple form: name, description, style
   - Generate reference image
   - Save profile for reuse

2. **Character-based Generation**
   - Dropdown to select character
   - Combine character + scene description
   - Use fixed seeds for consistency

3. **UI Improvements**
   - Character gallery
   - Preview before attaching
   - Regenerate option

## Phase 3: Advanced Features (1 week)

### Potential Additions
1. **LoRA Training** (if using Replicate)
   - Upload multiple reference images
   - Background training process
   - Much better consistency

2. **Image Variations**
   - Multiple options per generation
   - User picks favorite

3. **Smart Prompting**
   - Prompt templates
   - Style presets
   - Negative prompt optimization

4. **Performance**
   - Image CDN/caching
   - Progressive loading
   - Thumbnail generation

## Quick Start Commands

### 1. Test AWS S3 Connection
```javascript
// test_s3.js
const AWS = require('aws-sdk');
require('dotenv').config();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// List bucket contents
s3.listObjects({ Bucket: 'kuvatjakalat' }, (err, data) => {
  if (err) console.error('Error:', err);
  else console.log('Success:', data);
});
```

### 2. Test AI Generation
```javascript
// test_replicate.js
const Replicate = require('replicate');
require('dotenv').config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function test() {
  const output = await replicate.run(
    "stability-ai/stable-diffusion:db21e45d",
    {
      input: {
        prompt: "a wizard casting a spell, fantasy art"
      }
    }
  );
  console.log(output);
}

test();
```

## Questions Before Starting

1. **Which AI service to try first?**
   - Replicate (easier API, good docs)
   - Stability AI (more control)
   - Leonardo AI (built-in consistency)

2. **Image specifications?**
   - Size: 512x512 or 1024x1024?
   - Format: WebP or JPEG?
   - Quality level?

3. **User experience preferences?**
   - Generate during post creation?
   - Separate image generation page?
   - How many images per post?

4. **AWS credentials ready?**
   - Do you have Access Key ID?
   - Do you have Secret Access Key?
   - Confirm bucket region?

## Next Steps

Once you answer the questions above, I can:
1. Create the basic image service
2. Set up S3 integration
3. Add simple UI to test generation
4. Deploy to localhost for testing

This phased approach lets us validate the concept quickly before building the full feature.