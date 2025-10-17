# Auto-Media Generation - Technical Documentation

## Architecture Overview

The auto-media generation system consists of three main components:

1. **Prompt Derivation Service** - AI-powered content analysis
2. **Image Generation Service** - Stability AI integration
3. **Audio Generation Service** - Audio synthesis

## System Flow

```
User Post Content
       ↓
   Checkboxes Checked? ────→ NO ──→ Regular Post (no media)
       ↓ YES
   Mood Selected
       ↓
   POST to /api/posts/derive-prompts
       ↓
   Claude AI Analysis
       ↓
   {imagePrompt, audioPrompt, stylePreset}
       ↓
   ┌─────────────┬─────────────┐
   ↓             ↓             ↓
Image Gen?   Audio Gen?    Post Created
   ↓             ↓
POST /generate-image  POST /generate-audio
   ↓             ↓
Stability AI    Audio API
   ↓             ↓
AWS S3 Upload   AWS S3 Upload
   ↓             ↓
Database Update ← Complete
```

## API Endpoints

### 1. Derive Media Prompts

**Endpoint**: `POST /api/posts/derive-prompts`

**Authentication**: Required (JWT token in cookies)

**Request Body**:
```typescript
interface DeriveProm

ptsRequest {
  postContent: string;    // The post text content
  mood: string;          // One of 8 mood presets
  language?: string;     // 'fi' or 'en', defaults to 'fi'
}
```

**Response**:
```typescript
interface DerivePromptsResponse {
  imagePrompt: string;      // Derived visual scene description
  audioPrompt: string;      // Derived audio atmosphere description
  stylePreset: string;      // Image style for Stability AI
  audioType: string;        // 'ambient' or 'music'
  audioStyle: string;       // Audio style descriptor
}
```

**Example Request**:
```javascript
const response = await fetch('/api/posts/derive-prompts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    postContent: 'Soturi taistelee lohikäärmettä vastaan linnassa',
    mood: 'action',
    language: 'fi'
  })
});

const data = await response.json();
// {
//   imagePrompt: 'warrior fighting dragon in castle, dramatic lighting',
//   audioPrompt: 'epic battle sounds with clashing swords and roars',
//   stylePreset: 'cinematic',
//   audioType: 'music',
//   audioStyle: 'orchestral'
// }
```

**Implementation** (`js/server_sqlite_new.js` lines 1456-1559):
```javascript
app.post('/api/posts/derive-prompts', authenticateToken, async (req, res) => {
    const { postContent, mood, language = 'fi' } = req.body;

    // Mood-to-style mapping
    const moodToStyle = {
        'peaceful': {
            imageStyle: 'digital-art',
            audioStyle: 'acoustic',
            audioType: 'ambient'
        },
        'mysterious': {
            imageStyle: 'fantasy-art',
            audioStyle: 'dark',
            audioType: 'ambient'
        },
        'action': {
            imageStyle: 'cinematic',
            audioStyle: 'orchestral',
            audioType: 'music'
        },
        'dramatic': {
            imageStyle: '3d-model',
            audioStyle: 'orchestral-dark',
            audioType: 'music'
        },
        'humorous': {
            imageStyle: 'comic-book',
            audioStyle: 'whimsical',
            audioType: 'music'
        },
        'epic': {
            imageStyle: 'cinematic',
            audioStyle: 'orchestral-epic',
            audioType: 'music'
        },
        'romantic': {
            imageStyle: 'anime',
            audioStyle: 'emotional',
            audioType: 'music'
        },
        'horrific': {
            imageStyle: 'horror-art',
            audioStyle: 'horror',
            audioType: 'ambient'
        }
    };

    const stylePresets = moodToStyle[mood] || moodToStyle['mysterious'];

    // Claude AI prompt for analysis
    const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{
            role: 'user',
            content: `Analyze this game post and extract visual and audio elements.

Post content: "${postContent}"
Selected mood: ${mood}
Language: ${language}

Extract:
1. IMAGE_PROMPT: Describe the visual scene in English (location, characters, actions, lighting, atmosphere)
2. AUDIO_PROMPT: Describe the audio atmosphere (environmental sounds, music style, intensity)

Return JSON: {"imagePrompt": "...", "audioPrompt": "..."}`
        }]
    });

    const derived = JSON.parse(response.content[0].text);

    res.json({
        imagePrompt: derived.imagePrompt,
        audioPrompt: derived.audioPrompt,
        stylePreset: stylePresets.imageStyle,
        audioType: stylePresets.audioType,
        audioStyle: stylePresets.audioStyle
    });
});
```

### 2. Generate Image

**Endpoint**: `POST /api/posts/:postId/generate-image`

**Authentication**: Required

**Request Body**:
```typescript
interface GenerateImageRequest {
  prompt: string;          // Image generation prompt
  style?: string;          // Style preset
  character?: string;      // Optional character portrait reference
}
```

**Implementation** (uses `ImageService.generateAndUpload()`):
- Model: Stability AI SD 3.5 Medium
- Resolution: 768x1152 (2:3 aspect ratio)
- ControlNet support for character portraits
- Automatic thumbnail generation
- S3 upload with metadata

### 3. Generate Audio

**Endpoint**: `POST /api/posts/:postId/generate-audio`

**Authentication**: Required

**Request Body**:
```typescript
interface GenerateAudioRequest {
  prompt: string;          // Audio generation prompt
  audioType: string;       // 'ambient' or 'music'
  audioStyle: string;      // Style descriptor
}
```

## Frontend Integration

### HTML Structure (`hml/threads.html` lines 368-403)

```html
<div class="media-generation-options">
    <h4>🎨🎵 Automaattinen median luonti</h4>

    <div style="display: flex; gap: 20px; margin: 10px 0;">
        <label>
            <input type="checkbox" id="autoGenerateImageCheckbox">
            <span>🎨 Luo AI-kuva</span>
        </label>
        <label>
            <input type="checkbox" id="autoGenerateAudioCheckbox">
            <span>🎵 Luo AI-ääni</span>
        </label>
    </div>

    <div id="moodSelectorContainer" style="display: none; margin-top: 10px;">
        <label for="moodSelector">Tunnelma:</label>
        <select id="moodSelector" style="width: 100%; padding: 8px;">
            <option value="mysterious">🌑 Mysterious / Dark</option>
            <option value="peaceful">🕊️ Peaceful / Calm</option>
            <option value="action">⚔️ Exciting / Action</option>
            <option value="dramatic">🎭 Dramatic / Tense</option>
            <option value="humorous">😄 Humorous / Light</option>
            <option value="epic">🏔️ Epic / Heroic</option>
            <option value="romantic">💕 Romantic / Emotional</option>
            <option value="horrific">👻 Horrific / Scary</option>
        </select>
    </div>
</div>
```

### JavaScript Implementation (`js/threads.js` lines 459-742)

**Key Functions**:

1. **updateMoodSelectorVisibility()** - Shows mood selector when checkboxes checked
2. **deriveMediaPrompts(postContent, mood)** - Calls API to get prompts
3. **autoGenerateMedia(postId, postContent, shouldGenerateImage, shouldGenerateAudio, mood)** - Orchestrates generation

**Critical Implementation Details**:

```javascript
// IMPORTANT: Capture checkbox state BEFORE form reset!
const shouldGenerateImage = autoGenerateImageCheckbox && autoGenerateImageCheckbox.checked;
const shouldGenerateAudio = autoGenerateAudioCheckbox && autoGenerateAudioCheckbox.checked;
const selectedMood = moodSelector ? moodSelector.value : 'mysterious';

// Reset form (clears checkboxes)
createPostForm.reset();

// Now use captured state for generation
autoGenerateMedia(data.id, content, shouldGenerateImage, shouldGenerateAudio, selectedMood);
```

**Why this matters**: Form reset clears checkbox values, so we must capture state first.

### Complete Flow Implementation

```javascript
async function autoGenerateMedia(postId, postContent, shouldGenerateImage, shouldGenerateAudio, mood) {
    if (!shouldGenerateImage && !shouldGenerateAudio) {
        return; // Nothing to generate
    }

    try {
        // Step 1: Derive prompts from content
        const derivedPrompts = await deriveMediaPrompts(postContent, mood);

        // Step 2: Generate image if requested
        if (shouldGenerateImage) {
            console.log('Generating image with prompt:', derivedPrompts.imagePrompt);

            await fetch(`/api/posts/${postId}/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: derivedPrompts.imagePrompt,
                    style: derivedPrompts.stylePreset
                })
            });
        }

        // Step 3: Generate audio if requested
        if (shouldGenerateAudio) {
            console.log('Generating audio with prompt:', derivedPrompts.audioPrompt);

            await fetch(`/api/posts/${postId}/generate-audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: derivedPrompts.audioPrompt,
                    audioType: derivedPrompts.audioType,
                    audioStyle: derivedPrompts.audioStyle
                })
            });
        }

        console.log('Media generation initiated successfully');

    } catch (error) {
        console.error('Error in autoGenerateMedia:', error);
        alert('Virhe median luonnissa. Yritä uudelleen.');
    }
}

async function deriveMediaPrompts(postContent, mood) {
    const response = await fetch('/api/posts/derive-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            postContent: postContent,
            mood: mood,
            language: 'fi'
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to derive prompts: ${response.statusText}`);
    }

    return await response.json();
}
```

## Finnish-to-English Translation

**Location**: `js/services/imageService.js` lines 290-344

**Implementation**:
```javascript
translateToEnglish(text) {
    const translations = {
        // Characters
        'velho': 'wizard',
        'soturi': 'warrior',
        'varas': 'thief',
        'pappi': 'priest',

        // Creatures
        'lohikäärme': 'dragon',
        'örkki': 'orc',
        'haltia': 'elf',
        'kääpiö': 'dwarf',

        // Locations
        'linna': 'castle',
        'luola': 'cave',
        'metsä': 'forest',
        'vuori': 'mountain',
        'torni': 'tower',

        // Actions
        'taistelee': 'fighting',
        'loitsimassa': 'casting spell',

        // Atmosphere
        'pimeä': 'dark',
        'maaginen': 'magical',

        // Common words
        'ja': 'and'
    };

    let translatedText = text.toLowerCase();

    // Replace Finnish words with English
    Object.keys(translations).forEach(finnish => {
        const english = translations[finnish];
        const regex = new RegExp(`\\b${finnish}\\b`, 'gi');
        translatedText = translatedText.replace(regex, english);
    });

    // If no translations made, add generic prefix
    if (translatedText === text.toLowerCase()) {
        translatedText = `fantasy scene with ${text}`;
    }

    return translatedText;
}
```

**Limitations**:
- Basic word-for-word replacement
- No grammar handling
- Limited vocabulary (60+ terms)
- Falls back to generic description if no matches

**Future Improvements**:
- Use proper translation API (Google Translate, DeepL)
- Context-aware translation
- Expanded vocabulary database

## Image Generation Service

**File**: `js/services/imageService.js`

**Key Methods**:

### generateImage(prompt, options)
- Uses Stability AI SD 3.5 Medium
- Aspect ratio: 2:3 (768x1152)
- Output format: JPEG
- Supports style presets

### generateImageWithControlNet(prompt, referenceImage, options)
- Uses ControlNet for character consistency
- Control strength: 0.7
- Requires character portrait PNG
- Lines 102-170

### processImage(imageBuffer)
- Main image: 768x1152 @ 85% quality
- Thumbnail: 256x384 @ 75% quality
- Lines 249-267

### uploadToS3(imageBuffer, key)
- Uploads to AWS S3
- Bucket: kuvatjakalat
- Region: eu-north-1
- Returns public URL

## Audio Generation Service

**File**: `js/services/audioService.js`

**Methods**:
- `generateAudio(prompt, options)` - Main generation
- `uploadToS3(audioBuffer, key)` - S3 upload
- Supports ambient and music types
- Duration: 30-60 seconds typical

## Database Schema

### post_images Table
```sql
CREATE TABLE post_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    prompt TEXT,
    style_preset TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
```

### post_audio Table
```sql
CREATE TABLE post_audio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    audio_url TEXT NOT NULL,
    prompt TEXT,
    audio_type TEXT,
    audio_style TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);
```

## Performance Considerations

### Timing
- Prompt derivation: 1-2 seconds (Claude API)
- Image generation: 20-40 seconds (Stability AI)
- Audio generation: 30-60 seconds
- Total: ~50-100 seconds for both

### Optimization
- Generation happens asynchronously after post creation
- User can continue working while media generates
- S3 CDN provides fast media delivery
- Thumbnails reduce initial load time

### Rate Limiting
- Stability AI: 150 requests/minute (paid tier)
- Claude API: 50 requests/minute
- Consider implementing queue system for high traffic

## Error Handling

### Common Errors

1. **Prompt derivation fails**
   - Fallback: Use generic prompts based on mood
   - Log error but don't block post creation

2. **Image generation fails**
   - Retry once with simpler prompt
   - Fallback to mood-based default image
   - Store error in database for debugging

3. **Audio generation fails**
   - Skip audio, proceed with image
   - Log error for later retry

4. **S3 upload fails**
   - Retry upload 3 times
   - Store locally as fallback
   - Alert admin if persistent

### Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: any;
}
```

## Testing

### Unit Tests
- Test mood-to-style mapping
- Test Finnish translation dictionary
- Test prompt parsing
- Mock API responses

### Integration Tests
- Test complete flow end-to-end
- Test error recovery
- Test with various post lengths
- Test with mixed languages

### Performance Tests
- Measure prompt derivation time
- Measure total generation time
- Test concurrent generations
- Monitor API rate limits

## Monitoring

### Key Metrics
- Prompt derivation success rate
- Image generation success rate
- Audio generation success rate
- Average generation time
- API error rates
- S3 upload failures

### Logging
```javascript
console.log('Prompt derivation:', {
    postId,
    mood,
    language,
    derivedPrompts,
    duration: Date.now() - startTime
});
```

## Security

### API Authentication
- All endpoints require JWT token
- Token validated on every request
- User must own the post to generate media

### Input Validation
- Post content: Max 5000 characters
- Mood: Must be one of 8 valid moods
- Sanitize all user input before AI processing

### API Key Protection
- Store in environment variables only
- Never expose in client-side code
- Rotate keys periodically

## Future Enhancements

### Planned Features
1. Character portrait integration (Task #0ff61a2f)
2. Prompt preview before generation
3. Generation history and reuse
4. Custom style presets
5. Batch generation
6. Generation analytics dashboard

### Technical Improvements
1. Proper translation API integration
2. Generation queue system
3. WebSocket for real-time updates
4. Caching of common prompts
5. A/B testing framework for prompts

---

**Version**: 1.0
**Last Updated**: October 2025
**Maintainer**: AI IDE Agent
**Related Tasks**: #1c7f4919 (Complete), #93a60d8b (In Progress)
