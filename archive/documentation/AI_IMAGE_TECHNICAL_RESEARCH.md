# AI Image Generation - Technical Research

## Character Consistency Solutions

### 1. **Replicate with SDXL + LoRA** ⭐ RECOMMENDED
```javascript
// Example using Replicate API
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// First, train a LoRA on character reference images
const training = await replicate.trainings.create({
  version: "stability-ai/sdxl-lora-trainer",
  input: {
    input_images: "https://s3.../character-refs.zip",
    token_string: "TOK", // Unique identifier for character
  }
});

// Then generate consistent images
const output = await replicate.run(
  "stability-ai/sdxl:lora-model-id",
  {
    input: {
      prompt: "TOK person as a wizard casting a spell",
      num_outputs: 1,
      guidance_scale: 7.5,
    }
  }
);
```

**Pros:**
- Very consistent character appearance
- Good API documentation
- Reasonable pricing ($0.0023 per image)

**Cons:**
- Requires training step (one-time per character)
- Training takes 10-20 minutes

### 2. **Leonardo.AI with Fixed Seed**
```javascript
// Leonardo AI approach
const generateImage = async (characterDesc, scene) => {
  const response = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LEONARDO_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: `${characterDesc}, ${scene}`,
      negative_prompt: "inconsistent features, different person",
      num_images: 1,
      width: 512,
      height: 512,
      guidance_scale: 7,
      seed: characterProfile.seed, // Fixed seed for consistency
      model_id: "6bef9f1b-29cb-40c7-b9df-32b51c1f67d3" // Leonardo Anime XL
    })
  });
};
```

**Pros:**
- Built-in character consistency features
- Fast generation
- Good anime/stylized output

**Cons:**
- Less consistent than LoRA
- More expensive ($0.05 per image)

### 3. **Stability AI Direct API**
```javascript
// Using img2img for consistency
const engineId = 'stable-diffusion-xl-1024-v1-0';

// Generate using reference image
const response = await fetch(
  `https://api.stability.ai/v1/generation/${engineId}/image-to-image`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${STABILITY_API_KEY}`,
    },
    body: JSON.stringify({
      init_image: characterProfile.reference_image_base64,
      init_image_mode: "IMAGE_STRENGTH",
      image_strength: 0.35, // Keep character, change scene
      text_prompts: [
        {
          text: scene_description,
          weight: 1
        }
      ],
      cfg_scale: 7,
      samples: 1,
      steps: 30,
    }),
  }
);
```

## AWS S3 Setup Guide

### 1. Create IAM User for Application
```bash
# AWS CLI commands
aws iam create-user --user-name eno-game-platform
aws iam attach-user-policy --user-name eno-game-platform --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam create-access-key --user-name eno-game-platform
```

### 2. Bucket Configuration
```json
// Bucket Policy for public read
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::kuvatjakalat/*"
    }
  ]
}
```

### 3. CORS Configuration
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:3000", "https://www.iinou.eu"],
    "ExposeHeaders": []
  }
]
```

## Implementation Architecture

### Backend Service Structure
```javascript
// services/imageGeneration.js
class ImageGenerationService {
  constructor() {
    this.s3Client = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: 'eu-north-1' // Or your bucket region
    });
    
    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
  }

  async generateCharacterImage(characterProfile, sceneDescription) {
    // 1. Generate image using AI
    const imageUrl = await this.generateWithAI(characterProfile, sceneDescription);
    
    // 2. Download image
    const imageBuffer = await this.downloadImage(imageUrl);
    
    // 3. Process image (resize, optimize)
    const processedImage = await this.processImage(imageBuffer);
    
    // 4. Upload to S3
    const s3Url = await this.uploadToS3(processedImage, characterProfile.game_id);
    
    return s3Url;
  }
}
```

## Character Profile System

### Character Template Structure
```javascript
const characterTemplate = {
  // Core identity (never changes)
  core: {
    name: "Elara",
    gender: "female",
    age: "young adult",
    token: "ELARA001", // For LoRA
  },
  
  // Physical features (consistent)
  physical: {
    hair: "long silver hair with blue highlights",
    eyes: "bright purple eyes",
    build: "athletic build",
    height: "tall",
    distinguishing: "crescent moon tattoo on forehead"
  },
  
  // Style preferences
  style: {
    artStyle: "fantasy anime style",
    quality: "highly detailed, 8k, masterpiece",
    lighting: "dramatic lighting, volumetric fog"
  },
  
  // Negative prompts (what to avoid)
  negative: [
    "multiple people",
    "inconsistent features", 
    "different character",
    "bad anatomy"
  ]
};
```

### Prompt Construction
```javascript
function buildPrompt(character, scene) {
  const parts = [
    character.core.token || character.core.name,
    Object.values(character.physical).join(", "),
    scene,
    character.style.quality
  ];
  
  return {
    prompt: parts.join(", "),
    negative_prompt: character.negative.join(", ")
  };
}
```

## Cost Optimization Strategies

1. **Image Caching**
   - Cache generated images by prompt hash
   - Reuse similar scenes

2. **Progressive Quality**
   - Generate low-res preview first
   - Full quality on user confirmation

3. **Credit System**
   ```sql
   CREATE TABLE user_credits (
     user_id INTEGER PRIMARY KEY,
     credits_remaining INTEGER DEFAULT 100,
     credits_used INTEGER DEFAULT 0,
     last_reset TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   ```

## Next Steps for Proof of Concept

1. **Set up test environment**
   ```bash
   npm install aws-sdk replicate sharp
   ```

2. **Create .env variables**
   ```
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_BUCKET_NAME=kuvatjakalat
   AWS_REGION=eu-north-1
   REPLICATE_API_TOKEN=your_token
   ```

3. **Test basic generation flow**
   - Simple prompt → AI → S3 pipeline
   - Verify S3 upload works
   - Test image display in frontend

4. **Evaluate consistency**
   - Generate same character in 5 different scenes
   - Compare consistency across methods
   - Choose best approach

Would you like me to start implementing a proof of concept with one of these approaches?