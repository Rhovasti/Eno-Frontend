const AWS = require('aws-sdk');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class ImageService {
    constructor() {
        // Initialize AWS S3
        this.s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION
        });
        
        this.bucketName = process.env.AWS_BUCKET_NAME;
        this.stabilityApiKey = process.env.STABILITY_API_KEY;
    }

    /**
     * Generate an image using Stability AI
     * @param {string} prompt - The text prompt for image generation
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} - Image buffer
     */
    async generateImage(prompt, options = {}) {
        return new Promise((resolve, reject) => {
            const hostname = 'api.stability.ai';
            const path = '/v2beta/stable-image/generate/sd3';

            // Use form-data for SD 3.5 Medium
            const FormData = require('form-data');
            const form = new FormData();
            
            form.append('prompt', prompt);
            form.append('model', 'sd3.5-medium');
            form.append('output_format', 'jpeg');
            form.append('aspect_ratio', '2:3');  // 768x1152 optimal for SD 3.5 Medium
            
            if (options.style) {
                form.append('style_preset', options.style);
            }
            
            if (options.negativePrompt) {
                form.append('negative_prompt', options.negativePrompt);
            }

            const requestOptions = {
                hostname: hostname,
                path: path,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.stabilityApiKey}`,
                    'Accept': 'image/*',
                    ...form.getHeaders()
                }
            };

            const req = https.request(requestOptions, (res) => {
                if (res.statusCode !== 200) {
                    let errorData = '';
                    res.on('data', (chunk) => {
                        errorData += chunk;
                    });
                    res.on('end', () => {
                        reject(new Error(`SD 3.5 Medium generation failed: ${res.statusCode} - ${errorData}`));
                    });
                    return;
                }

                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    try {
                        const imageBuffer = Buffer.concat(chunks);
                        resolve(imageBuffer);
                    } catch (error) {
                        reject(new Error(`Failed to process image response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            form.pipe(req);
        });
    }

    /**
     * Generate an image with character reference using Stability AI ControlNet
     * @param {string} prompt - The text prompt for image generation
     * @param {Buffer} referenceImage - Reference image buffer
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} - Image buffer
     */
    async generateImageWithControlNet(prompt, referenceImage, options = {}) {
        return new Promise((resolve, reject) => {
            const hostname = 'api.stability.ai';
            const pathUrl = '/v2beta/stable-image/control/structure';

            // Use form-data for ControlNet endpoint
            const FormData = require('form-data');
            const form = new FormData();
            
            form.append('prompt', prompt);
            form.append('model', 'sd3.5-medium'); // Use SD 3.5 Medium
            form.append('control_strength', '0.7'); // High strength for sketch consistency
            form.append('image', referenceImage, { filename: 'reference.png' });
            form.append('output_format', 'jpeg');
            form.append('aspect_ratio', '2:3'); // 768x1152 optimal for SD 3.5 Medium
            
            if (options.style) {
                form.append('style_preset', options.style);
            }
            
            if (options.negativePrompt) {
                form.append('negative_prompt', options.negativePrompt);
            }

            const requestOptions = {
                hostname: hostname,
                path: pathUrl,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.stabilityApiKey}`,
                    'Accept': 'image/*',
                    ...form.getHeaders()
                }
            };

            const req = https.request(requestOptions, (res) => {
                if (res.statusCode !== 200) {
                    let errorData = '';
                    res.on('data', (chunk) => {
                        errorData += chunk;
                    });
                    res.on('end', () => {
                        reject(new Error(`ControlNet SD 3.5 Medium generation failed: ${res.statusCode} - ${errorData}`));
                    });
                    return;
                }

                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    try {
                        const imageBuffer = Buffer.concat(chunks);
                        resolve(imageBuffer);
                    } catch (error) {
                        reject(new Error(`Failed to process image response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            form.pipe(req);
        });
    }

    /**
     * Generate an image with character reference using Stability AI image-to-image (fallback)
     * @param {string} prompt - The text prompt for image generation
     * @param {Buffer} referenceImage - Reference image buffer
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} - Image buffer
     */
    async generateImageWithReference(prompt, referenceImage, options = {}) {
        return new Promise((resolve, reject) => {
            const engineId = 'stable-diffusion-xl-1024-v1-0';
            const hostname = 'api.stability.ai';
            const pathUrl = `/v1/generation/${engineId}/image-to-image`;

            const formData = {
                init_image: referenceImage.toString('base64'),
                init_image_mode: 'IMAGE_STRENGTH',
                image_strength: 0.35, // Keep character features but change scene
                text_prompts: [
                    {
                        text: prompt,
                        weight: 1
                    }
                ],
                cfg_scale: 7,
                samples: 1,
                steps: 30,
                style_preset: options.style || undefined
            };

            const requestBody = JSON.stringify(formData);

            const requestOptions = {
                hostname: hostname,
                path: pathUrl,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.stabilityApiKey}`,
                    'Content-Length': Buffer.byteLength(requestBody)
                }
            };

            const req = https.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Image generation with reference failed: ${res.statusCode} - ${data}`));
                        return;
                    }

                    try {
                        const responseJSON = JSON.parse(data);
                        const image = responseJSON.artifacts[0];
                        const imageBuffer = Buffer.from(image.base64, 'base64');
                        
                        resolve(imageBuffer);
                    } catch (error) {
                        reject(new Error(`Failed to parse response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Process and optimize image
     * @param {Buffer} imageBuffer - Raw image buffer
     * @returns {Promise<Object>} - Processed image and thumbnail buffers
     */
    async processImage(imageBuffer) {
        // Main image - keep original resolution (768x1152) with quality optimization
        const mainImage = await sharp(imageBuffer)
            .jpeg({ quality: 85 })
            .toBuffer();

        // Thumbnail - portrait aspect ratio, smaller size for quick loading
        const thumbnail = await sharp(imageBuffer)
            .resize(256, 384, { fit: 'cover' })
            .jpeg({ quality: 75 })
            .toBuffer();

        return { mainImage, thumbnail };
    }

    /**
     * Upload image to S3
     * @param {Buffer} imageBuffer - Image buffer to upload
     * @param {string} key - S3 object key
     * @returns {Promise<string>} - Public URL of uploaded image
     */
    async uploadToS3(imageBuffer, key) {
        const params = {
            Bucket: this.bucketName,
            Key: key,
            Body: imageBuffer,
            ContentType: 'image/jpeg'
            // Removed ACL as bucket doesn't support it
        };

        const result = await this.s3.upload(params).promise();
        // Construct public URL manually
        return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    /**
     * Translate Finnish to English (basic translation for common terms)
     * @param {string} text - Text to translate
     * @returns {string} - Translated text
     */
    translateToEnglish(text) {
        // Common Finnish gaming/fantasy terms to English
        const translations = {
            'velho': 'wizard',
            'loitsimassa': 'casting spell',
            'loitsu': 'spell',
            'pimeä': 'dark',
            'pimeässä': 'in dark',
            'luola': 'cave',
            'luolassa': 'in cave',
            'tuli': 'fire',
            'tulipallo': 'fireball',
            'lohikäärme': 'dragon',
            'metsä': 'forest',
            'vuori': 'mountain',
            'linna': 'castle',
            'torni': 'tower',
            'miekka': 'sword',
            'kilpi': 'shield',
            'soturi': 'warrior',
            'varas': 'thief',
            'pappi': 'priest',
            'maaginen': 'magical',
            'taika': 'magic',
            'hirviö': 'monster',
            'örkkejä': 'orcs',
            'örkki': 'orc',
            'haltia': 'elf',
            'kääpiö': 'dwarf',
            'seikkailu': 'adventure',
            'taistelu': 'battle',
            'taistelemassa': 'fighting',
            'ja': 'and'
        };

        let translatedText = text.toLowerCase();
        
        // Replace Finnish words with English
        Object.keys(translations).forEach(finnish => {
            const english = translations[finnish];
            const regex = new RegExp(`\\b${finnish}\\b`, 'gi');
            translatedText = translatedText.replace(regex, english);
        });
        
        // If text is still mostly Finnish (no translations made), add a generic fantasy prefix
        if (translatedText === text.toLowerCase()) {
            translatedText = `fantasy scene with ${text}`;
        }
        
        return translatedText;
    }

    /**
     * Generate image and upload to S3
     * @param {Object} params - Generation parameters
     * @returns {Promise<Object>} - URLs and metadata
     */
    async generateAndUpload(params) {
        const { prompt, gameId, postId, userId, character, style } = params;
        
        try {
            // Translate prompt to English if needed
            const englishPrompt = this.translateToEnglish(prompt);
            console.log('Original prompt:', prompt);
            console.log('English prompt:', englishPrompt);
            console.log('Character:', character);
            
            let imageBuffer;
            
            // Check if we need to use character reference
            if (character) {
                const portraitPath = path.join(__dirname, '../../portraits', `${character}.png`);
                
                // Check if portrait exists
                if (await fs.access(portraitPath).then(() => true).catch(() => false)) {
                    console.log('Using character reference with ControlNet:', portraitPath);
                    
                    // Read the character portrait
                    const referenceImage = await fs.readFile(portraitPath);
                    
                    try {
                        // Try ControlNet first for best character consistency
                        console.log('Attempting ControlNet generation...');
                        imageBuffer = await this.generateImageWithControlNet(
                            englishPrompt,
                            referenceImage,
                            { 
                                style,
                                negativePrompt: 'blurry, bad quality, distorted, different character'
                            }
                        );
                        console.log('ControlNet generation successful');
                    } catch (controlNetError) {
                        console.log('ControlNet failed, falling back to image-to-image:', controlNetError.message);
                        
                        // Fallback to image-to-image if ControlNet fails
                        imageBuffer = await this.generateImageWithReference(
                            englishPrompt,
                            referenceImage,
                            { style }
                        );
                    }
                } else {
                    console.log('Character portrait not found, using text-only generation');
                    // Fallback to text-only generation with character name in prompt
                    imageBuffer = await this.generateImage(
                        `${character} character, ${englishPrompt}`,
                        { style }
                    );
                }
            } else {
                // 1. Generate image without character reference
                imageBuffer = await this.generateImage(englishPrompt, { style });
            }
            
            // 2. Process image
            const { mainImage, thumbnail } = await this.processImage(imageBuffer);
            
            // 3. Create S3 keys
            const timestamp = Date.now();
            const imageId = uuidv4();
            const mainKey = `games/${gameId}/posts/${postId}/${imageId}_${timestamp}.jpg`;
            const thumbnailKey = `games/${gameId}/posts/${postId}/${imageId}_${timestamp}_thumb.jpg`;
            
            // 4. Upload to S3
            console.log('Uploading to S3...');
            const [mainUrl, thumbnailUrl] = await Promise.all([
                this.uploadToS3(mainImage, mainKey),
                this.uploadToS3(thumbnail, thumbnailKey)
            ]);
            
            console.log('Image uploaded successfully:', mainUrl);
            
            return {
                imageUrl: mainUrl,
                thumbnailUrl: thumbnailUrl,
                prompt: prompt, // Keep original prompt for display
                englishPrompt: englishPrompt, // Store translated prompt too
                metadata: {
                    imageId,
                    gameId,
                    postId,
                    userId,
                    timestamp,
                    character: character || null,
                    style: style || null
                }
            };
        } catch (error) {
            console.error('Error in generateAndUpload:', error);
            throw error;
        }
    }

    /**
     * Test S3 connection
     * @returns {Promise<boolean>} - True if connection successful
     */
    async testS3Connection() {
        try {
            const result = await this.s3.listBuckets().promise();
            console.log('S3 Buckets:', result.Buckets.map(b => b.Name));
            return true;
        } catch (error) {
            console.error('S3 connection error:', error);
            return false;
        }
    }
}

module.exports = ImageService;