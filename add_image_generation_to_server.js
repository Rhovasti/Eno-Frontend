// Quick patch to add image generation to existing server_sqlite.js
// This adds a simple image generation endpoint

const fs = require('fs');

const imageGenerationEndpoint = `
// Image generation endpoint
app.post('/api/posts/:postId/generate-image', authenticateToken, async (req, res) => {
    try {
        const { prompt, style, sketch } = req.body;
        const postId = req.params.postId;
        const userId = req.user.id;

        // Simple mock image generation for now
        // In real implementation, this would call Stability AI
        const mockImageUrl = \`https://via.placeholder.com/512x512/0066cc/ffffff?text=\${encodeURIComponent(prompt.substring(0, 20))}\`;
        
        // Save to database (simplified - no actual image generation)
        const insertImageQuery = \`
            INSERT INTO post_images (post_id, user_id, prompt, image_url, thumbnail_url, generation_params)
            VALUES (?, ?, ?, ?, ?, ?)
        \`;
        
        const generationParams = JSON.stringify({
            style: style || 'default',
            timestamp: new Date().toISOString(),
            model: 'mock'
        });

        db.run(insertImageQuery, [
            postId,
            userId,
            prompt,
            mockImageUrl,
            mockImageUrl, // Using same URL for thumbnail
            generationParams
        ], function(err) {
            if (err) {
                console.error('Error saving generated image:', err);
                return res.status(500).json({ error: 'Failed to save generated image' });
            }

            res.json({
                success: true,
                image: {
                    id: this.lastID,
                    url: mockImageUrl,
                    thumbnail_url: mockImageUrl,
                    prompt: prompt
                }
            });
        });

    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: 'Image generation failed' });
    }
});

// Get images for a post
app.get('/api/posts/:postId/images', authenticateToken, (req, res) => {
    const postId = req.params.postId;
    
    const query = \`
        SELECT id, prompt, image_url, thumbnail_url, generation_params, created_at
        FROM post_images 
        WHERE post_id = ?
        ORDER BY created_at DESC
    \`;
    
    db.all(query, [postId], (err, images) => {
        if (err) {
            console.error('Error fetching post images:', err);
            return res.status(500).json({ error: 'Failed to fetch images' });
        }
        
        res.json(images);
    });
});
`;

// Read the current server file
const serverPath = './js/server_sqlite.js';
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Find where to insert the new endpoints (before the HTML serving section)
const insertPoint = serverContent.indexOf('// Serve HTML pages');

if (insertPoint === -1) {
    console.error('Could not find insertion point in server file');
    process.exit(1);
}

// Insert the new endpoints
const updatedContent = 
    serverContent.slice(0, insertPoint) + 
    imageGenerationEndpoint + 
    '\n' +
    serverContent.slice(insertPoint);

// Write the updated file
fs.writeFileSync('./js/server_sqlite_with_images.js', updatedContent);

console.log('Created server_sqlite_with_images.js with image generation endpoints');
console.log('Note: This uses mock image generation. For real Stability AI integration, use server_sqlite_new.js');