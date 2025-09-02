# AI Image Generation Flow Diagram

## User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIRST TIME SETUP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User → "Create Character" → Character Form                     │
│                                    ↓                             │
│                            ┌──────────────────┐                  │
│                            │ • Name           │                  │
│                            │ • Description    │                  │
│                            │ • Art Style      │                  │
│                            └────────┬─────────┘                  │
│                                     ↓                            │
│                            Generate Reference                    │
│                                     ↓                            │
│                            ┌─────────────────┐                   │
│                            │   [Preview]     │                   │
│                            │  ┌───────────┐  │                   │
│                            │  │   🧙‍♀️    │  │ ← Regenerate     │
│                            │  │  Elara    │  │                   │
│                            │  └───────────┘  │                   │
│                            │   [Save] [Try Again]                │
│                            └─────────────────┘                   │
│                                     ↓                            │
│                            Character Profile Saved               │
│                              (with LoRA training)               │
└─────────────────────────────────────────────────────────────────┘

                                     ↓

┌─────────────────────────────────────────────────────────────────┐
│                         POSTING WITH IMAGE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Write Post → Click "Add AI Image" → Image Options              │
│                                           ↓                      │
│                                  ┌─────────────────┐             │
│                                  │ Select:         │             │
│                                  │ ○ Elara        │             │
│                                  │ ○ New Character│             │
│                                  │ ○ Scene Only   │             │
│                                  └────────┬────────┘             │
│                                           ↓                      │
│                                  Scene Description               │
│                                  ┌─────────────────┐             │
│                                  │ "Casting fire   │             │
│                                  │  spell in dark  │             │
│                                  │  dungeon"       │             │
│                                  └────────┬────────┘             │
│                                           ↓                      │
│                                    [Generate]                    │
│                                           ↓                      │
│                                  ⏳ Generating...                │
│                                     (10-15 sec)                  │
│                                           ↓                      │
│                                  ┌─────────────────┐             │
│                                  │   🔥🧙‍♀️🔥    │             │
│                                  │ Elara casting   │             │
│                                  │ fire spell      │             │
│                                  └─────────────────┘             │
│                                           ↓                      │
│                                  [Attach to Post]                │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │     │   Backend    │     │  External    │
│  (Browser)   │     │  (Node.js)   │     │  Services    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                     │                     │
       │ 1. Request Image    │                     │
       │────────────────────>│                     │
       │                     │                     │
       │                     │ 2. Build Prompt     │
       │                     │────────────┐        │
       │                     │            │        │
       │                     │<───────────┘        │
       │                     │                     │
       │                     │ 3. Call AI API      │
       │                     │────────────────────>│
       │                     │                     │ Replicate/
       │                     │                     │ Stability
       │                     │ 4. Image URL        │
       │                     │<────────────────────│
       │                     │                     │
       │                     │ 5. Download Image   │
       │                     │────────────┐        │
       │                     │            │        │
       │                     │<───────────┘        │
       │                     │                     │
       │                     │ 6. Upload to S3     │
       │                     │────────────────────>│
       │                     │                     │ AWS S3
       │                     │ 7. S3 URL           │
       │                     │<────────────────────│
       │                     │                     │
       │                     │ 8. Save to DB       │
       │                     │────────────┐        │
       │                     │            │        │
       │                     │<───────────┘        │
       │                     │                     │
       │ 9. Return S3 URL    │                     │
       │<────────────────────│                     │
       │                     │                     │
       │ 10. Display Image   │                     │
       │────────────┐        │                     │
       │            │        │                     │
       │<───────────┘        │                     │
```

## Database Relationships

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│    users    │     │character_profiles│     │   posts     │
├─────────────┤     ├──────────────────┤     ├─────────────┤
│ id          │────<│ user_id          │     │ id          │
│ username    │     │ game_id          │>────│ beat_id     │
│ email       │     │ name             │     │ author_id   │
└─────────────┘     │ base_description │     │ content     │
                    │ style_modifiers  │     └──────┬──────┘
                    │ reference_seed   │            │
                    │ lora_model_id    │            │
                    └─────────┬────────┘            │
                              │                     │
                              ↓                     ↓
                    ┌──────────────────┐   ┌─────────────┐
                    │  post_images     │   │ dice_rolls  │
                    ├──────────────────┤   ├─────────────┤
                    │ id               │   │ id          │
                    │ post_id          │>──│ post_id     │
                    │ character_id     │   │ notation    │
                    │ prompt           │   │ total       │
                    │ image_url        │   └─────────────┘
                    │ thumbnail_url    │
                    │ generation_params│
                    └──────────────────┘
```

## Component Breakdown

### Frontend Components
```
ThreadsPage
├── PostForm
│   ├── TextEditor
│   ├── DiceRollSection
│   └── ImageGeneratorSection
│       ├── CharacterSelector
│       ├── SceneDescriptor
│       ├── GenerationPreview
│       └── AttachButton
└── PostDisplay
    ├── PostContent
    ├── DiceRollDisplay
    └── ImageGallery
```

### Backend Endpoints
```
/api/characters
  POST   - Create new character profile
  GET    - List user's characters
  
/api/characters/:id/train
  POST   - Train LoRA model for character

/api/images/generate
  POST   - Generate new image
  
/api/posts/:postId/images
  POST   - Attach image to post
  GET    - Get post images
```

## Key Decisions Needed

1. **AI Service Selection**
   - Replicate (with LoRA): Best consistency, requires training
   - Leonardo AI: Good balance, immediate use
   - Stability AI: Most flexible, moderate consistency

2. **Character Creation Flow**
   - How many reference images for training?
   - Allow custom uploads or AI-generated only?
   - Pre-made character templates?

3. **User Limits**
   - Images per day/month?
   - Credit system or subscription?
   - Free tier limitations?

4. **Quality Settings**
   - Image resolution (512x512, 1024x1024)?
   - Multiple quality tiers?
   - Thumbnail generation?

5. **Content Moderation**
   - Automated prompt filtering?
   - Manual review process?
   - Banned words/concepts?