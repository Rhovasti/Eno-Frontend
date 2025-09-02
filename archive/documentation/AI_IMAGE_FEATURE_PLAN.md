# AI Image Generation Feature Plan

## Overview
Add AI-generated images to posts with consistent character generation across different scenes.

## Key Components

### 1. AI Image Generation Service
**Options to consider:**
- **Stability AI (Stable Diffusion)** - Good quality, API available
- **Replicate** - Hosts multiple models including SDXL with LoRA support
- **Leonardo AI** - Has character consistency features
- **Midjourney** - Best quality but no official API

**Character Consistency Solutions:**
- Use LoRA (Low-Rank Adaptation) models for consistent characters
- Implement seed + prompt engineering for consistency
- Store character "templates" with specific descriptors
- Consider using img2img with reference images

### 2. AWS S3 Integration
**Bucket:** kuvatjakalat
**Required:**
- AWS SDK for JavaScript
- IAM credentials (Access Key ID, Secret Access Key)
- Bucket policy for public read access
- Organized folder structure: `/games/{gameId}/characters/{characterId}/`

### 3. Database Schema
```sql
-- Character profiles for consistency
CREATE TABLE character_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    base_description TEXT NOT NULL, -- Core features for consistency
    style_modifiers TEXT, -- Art style preferences
    reference_seed INTEGER, -- For reproducibility
    reference_image_url TEXT, -- S3 URL of reference image
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Generated images
CREATE TABLE post_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    character_profile_id INTEGER,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    image_url TEXT NOT NULL, -- S3 URL
    thumbnail_url TEXT, -- S3 URL for thumbnail
    generation_params TEXT, -- JSON with seed, model, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (character_profile_id) REFERENCES character_profiles(id)
);
```

### 4. User Flow

#### Character Creation (First Time)
1. User clicks "Create Character" in game
2. Fills out character form:
   - Name
   - Physical description (hair, eyes, clothing, etc.)
   - Art style preference (anime, realistic, fantasy art, etc.)
3. System generates reference image
4. User can regenerate until satisfied
5. Character profile saved for future use

#### Image Generation in Posts
1. User writes post content
2. Clicks "Add AI Image" button
3. Options:
   - Use existing character
   - Create scene with character
   - Generate scene without character
4. Provides scene description
5. System combines character template + scene description
6. Image generated and attached to post

### 5. Technical Architecture

```
Frontend (threads.js)
    ↓
Backend API (server_sqlite.js)
    ↓
Image Generation Service
    ├── Generate image via AI API
    ├── Process/resize image
    ├── Upload to S3
    └── Return URLs
```

### 6. Implementation Phases

**Phase 1: Basic Infrastructure**
- AWS S3 setup and testing
- Database schema implementation
- Basic API endpoints

**Phase 2: AI Integration**
- Integrate chosen AI service
- Basic image generation without consistency
- S3 upload pipeline

**Phase 3: Character Consistency**
- Character profile system
- Template-based generation
- Reference image system

**Phase 4: UI/UX Polish**
- Smooth generation flow
- Loading states
- Image gallery view

### 7. Cost Considerations
- AI API costs (typically $0.01-0.10 per image)
- AWS S3 storage ($0.023 per GB/month)
- AWS S3 transfer ($0.09 per GB)
- Consider implementing credits/limits per user

### 8. Security Considerations
- Content moderation for prompts
- Rate limiting per user
- Secure S3 bucket configuration
- Never expose AWS credentials to frontend

## Recommended First Steps
1. Set up AWS credentials and test S3 access
2. Choose AI image service and get API key
3. Create basic proof of concept with simple generation
4. Test character consistency approaches
5. Build full feature based on what works best

## Questions to Resolve
1. Which AI service provides best character consistency?
2. Budget for image generation?
3. Image size/quality requirements?
4. Should users have generation limits?
5. Need for content moderation?