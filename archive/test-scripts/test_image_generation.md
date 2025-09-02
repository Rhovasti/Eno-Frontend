# Testing AI Image Generation

## Current Status
✅ Server running on http://localhost:3000
✅ AWS S3 connected and accessible
✅ Image generation endpoints added
⚠️  Stability AI API key not configured yet

## To Test the Feature:

1. **Set up Stability AI API Key**
   - Get API key from https://platform.stability.ai/
   - Add to `.env`: `STABILITY_API_KEY=your-key-here`
   - Restart server

2. **Test Flow**
   ```
   1. Login at http://localhost:3000/hml/login.html
   2. Go to Threads: http://localhost:3000/hml/threads.html
   3. Select a game and chapter
   4. Create a new post
   5. After posting, the image generation section will appear
   6. Enter a prompt like "a wizard casting a fireball in a dark dungeon"
   7. Click "🎨 Luo kuva"
   8. Image will be generated and uploaded to S3
   ```

## API Endpoints Created:

### Generate Image for Post
```
POST /api/posts/:postId/generate-image
Authorization: Bearer <token>
{
  "prompt": "a wizard casting a spell",
  "style": "fantasy-art" // optional
}
```

### Get Post Images
```
GET /api/posts/:postId/images
Authorization: Bearer <token>
```

### Test S3 Connection (Admin only)
```
GET /api/test-s3
Authorization: Bearer <token>
```

## What's Working:

1. **S3 Integration**
   - Connected to bucket: kuvatjakalat
   - Can upload files
   - Public URLs generated

2. **Database Schema**
   - `post_images` table created
   - Stores prompts, URLs, metadata

3. **UI Components**
   - Image generation form appears after post
   - Loading states
   - Preview display
   - Images shown in posts

## Next Steps:

1. Add Stability AI API key to `.env`
2. Test end-to-end generation
3. Consider adding:
   - Multiple images per post
   - Image regeneration
   - Delete image option
   - Character consistency (Phase 2)

## Without Stability AI Key:

The system will show "Image generation service not configured" error.
To test S3 only, you can manually upload an image to the bucket and add its URL to the database.