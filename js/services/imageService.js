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

        // Initialize Alibaba Cloud DashScope
        this.dashscopeApiKey = process.env.DASHSCOPE_API_KEY || 'sk-1b27dbcbab604e04808628d8d5022f45';
        this.dashscopeBaseUrl = 'https://dashscope-intl.aliyuncs.com/api/v1';
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
     * Generate an image with character reference using Stability AI ControlNet Structure API
     * This method is optimized for character consistency using the Structure endpoint
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

            // Enhanced prompt for character consistency
            const enhancedPrompt = `Maintain character appearance and features: ${prompt}`;

            form.append('prompt', enhancedPrompt);
            form.append('model', 'sd3.5-medium'); // Use SD 3.5 Medium
            form.append('control_strength', options.controlStrength || '0.6'); // Balanced strength for character consistency
            form.append('image', referenceImage, { filename: 'reference.png' });
            form.append('output_format', 'jpeg');
            form.append('aspect_ratio', '2:3'); // 768x1152 optimal for SD 3.5 Medium

            if (options.style) {
                form.append('style_preset', options.style);
            }

            // Enhanced negative prompt for character consistency
            const defaultNegativePrompt = 'blurry, bad quality, distorted, different character, changed appearance, different face, different hair, different eyes, different clothing style';
            const negativePrompt = options.negativePrompt ? `${options.negativePrompt}, ${defaultNegativePrompt}` : defaultNegativePrompt;
            form.append('negative_prompt', negativePrompt);

            console.log(`Structure API Request - Control strength: ${options.controlStrength || 0.6}, Enhanced prompt: ${enhancedPrompt}`);

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
                        reject(new Error(`Structure API generation failed: ${res.statusCode} - ${errorData}`));
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
                        reject(new Error(`Failed to process Structure API response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Structure API request failed: ${error.message}`));
            });

            form.pipe(req);
        });
    }

    /**
     * Generate an image using Qwen text-to-image API (simplified version)
     * @param {string} prompt - The text prompt for image generation
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} - Image buffer
     */
    async generateImageWithQwen(prompt, options = {}) {
        return new Promise((resolve, reject) => {
            const requestData = {
                model: 'qwen-image-plus',
                input: {
                    messages: [{
                        role: 'user',
                        content: [{
                            text: prompt
                        }]
                    }]
                },
                parameters: {
                    result_format: 'message',
                    stream: false,
                    watermark: false,
                    prompt_extend: true,
                    negative_prompt: options.negativePrompt || 'low quality, worst quality, deformed, distorted, disfigured, bad anatomy, extra fingers',
                    size: options.size || '1328*1328',
                    seed: options.seed || null
                }
            };

            const requestBody = JSON.stringify(requestData);

            const requestOptions = {
                hostname: 'dashscope-intl.aliyuncs.com',
                path: '/api/v1/services/aigc/multimodal-generation/generation',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.dashscopeApiKey}`,
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
                        reject(new Error(`Qwen text-to-image failed: ${res.statusCode} - ${data}`));
                        return;
                    }

                    try {
                        const responseJSON = JSON.parse(data);
                        console.log('Qwen response structure:', JSON.stringify(responseJSON, null, 2));

                        if (responseJSON.output && responseJSON.output.choices && responseJSON.output.choices.length > 0) {
                            const choice = responseJSON.output.choices[0];
                            if (choice.message && choice.message.content) {
                                const content = choice.message.content;
                                // Find the image in the content array
                                const imageItem = content.find(item => item.image);
                                if (imageItem && imageItem.image) {
                                    const imageUrl = imageItem.image;
                                    console.log('Generated image URL:', imageUrl);
                                    this.downloadImage(imageUrl)
                                        .then(imageBuffer => resolve(imageBuffer))
                                        .catch(error => reject(new Error(`Failed to download Qwen image: ${error.message}`)));
                                    return;
                                }
                            }
                        }

                        // Check if it's async response (fallback)
                        if (responseJSON.output && responseJSON.output.task_id) {
                            console.log('Got async task, polling for completion...');
                            this.pollQwenAsyncTask(responseJSON.output.task_id)
                                .then(imageUrl => {
                                    this.downloadImage(imageUrl)
                                        .then(imageBuffer => resolve(imageBuffer))
                                        .catch(error => reject(new Error(`Failed to download Qwen image: ${error.message}`)));
                                })
                                .catch(error => reject(new Error(`Qwen async task failed: ${error.message}`)));
                        } else {
                            reject(new Error('No image found in Qwen API response'));
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse Qwen response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Qwen API request failed: ${error.message}`));
            });

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Poll Qwen async task for completion
     * @param {string} taskId - The task ID to poll
     * @returns {Promise<string>} - Image URL when ready
     */
    async pollQwenAsyncTask(taskId) {
        return new Promise((resolve, reject) => {
            const maxAttempts = 30; // Maximum 30 attempts
            let attempts = 0;

            const poll = () => {
                attempts++;

                const requestOptions = {
                    hostname: 'dashscope-intl.aliyuncs.com',
                    path: `/api/v1/tasks/${taskId}`,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.dashscopeApiKey}`,
                        'Accept': 'application/json'
                    }
                };

                const req = https.request(requestOptions, (res) => {
                    let data = '';

                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        if (res.statusCode !== 200) {
                            reject(new Error(`Qwen task poll failed: ${res.statusCode} - ${data}`));
                            return;
                        }

                        try {
                            const responseJSON = JSON.parse(data);

                            if (responseJSON.output && responseJSON.output.task_status === 'SUCCEEDED') {
                                if (responseJSON.output.results && responseJSON.output.results.length > 0) {
                                    resolve(responseJSON.output.results[0].url);
                                } else {
                                    reject(new Error('Task succeeded but no image URL found'));
                                }
                            } else if (responseJSON.output && responseJSON.output.task_status === 'FAILED') {
                                reject(new Error(`Qwen async task failed: ${responseJSON.output.message || 'Unknown error'}`));
                            } else if (responseJSON.output && responseJSON.output.task_status === 'RUNNING') {
                                if (attempts < maxAttempts) {
                                    setTimeout(poll, 2000); // Poll every 2 seconds
                                } else {
                                    reject(new Error('Qwen async task timeout'));
                                }
                            } else {
                                reject(new Error(`Unknown Qwen task status: ${responseJSON.output?.task_status}`));
                            }
                        } catch (error) {
                            reject(new Error(`Failed to parse Qwen task response: ${error.message}`));
                        }
                    });
                });

                req.on('error', (error) => {
                    reject(new Error(`Qwen task poll request failed: ${error.message}`));
                });

                req.end();
            };

            poll();
        });
    }

    /**
     * Edit an image using Qwen-image-edit API
     * @param {string} prompt - The editing instruction
     * @param {string} imageUrl - URL of the image to edit
     * @param {Buffer} characterPortrait - Character portrait buffer
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} - Edited image buffer
     */
    async editImageWithQwen(prompt, imageUrl, characterPortrait, options = {}) {
        return new Promise((resolve, reject) => {
            // Convert character portrait to base64 if provided
            const characterImage = characterPortrait ?
                `data:image/png;base64,${characterPortrait.toString('base64')}` : null;

            const content = [];

            // Add the base image
            content.push({ image: imageUrl });

            // Add character portrait if provided
            if (characterImage) {
                content.push({ image: characterImage });
            }

            // Add editing instruction
            const instruction = characterPortrait ?
                `Add the character from Image 2 to Image 1, maintaining the character's appearance and facial features: ${prompt}` :
                prompt;
            content.push({ text: instruction });

            const requestData = {
                model: 'qwen-image-edit',
                input: {
                    messages: [{
                        role: 'user',
                        content: content
                    }]
                },
                parameters: {
                    result_format: 'message',
                    stream: false,
                    watermark: false,
                    negative_prompt: options.negativePrompt || 'blurry, bad quality, distorted, different character, changed appearance, different face',
                    seed: options.seed || null
                }
            };

            const requestBody = JSON.stringify(requestData);

            const requestOptions = {
                hostname: 'dashscope-intl.aliyuncs.com',
                path: '/api/v1/services/aigc/multimodal-generation/generation',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.dashscopeApiKey}`,
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
                        reject(new Error(`Qwen image edit failed: ${res.statusCode} - ${data}`));
                        return;
                    }

                    try {
                        const responseJSON = JSON.parse(data);
                        console.log('Qwen edit response structure:', JSON.stringify(responseJSON, null, 2));

                        if (responseJSON.output && responseJSON.output.choices && responseJSON.output.choices.length > 0) {
                            const choice = responseJSON.output.choices[0];
                            if (choice.message && choice.message.content) {
                                const content = choice.message.content;
                                // Find the image in the content array
                                const imageItem = content.find(item => item.image);
                                if (imageItem && imageItem.image) {
                                    const editedImageUrl = imageItem.image;
                                    console.log('Edited image URL:', editedImageUrl);
                                    this.downloadImage(editedImageUrl)
                                        .then(imageBuffer => resolve(imageBuffer))
                                        .catch(error => reject(new Error(`Failed to download edited Qwen image: ${error.message}`)));
                                    return;
                                }
                            }
                        }

                        reject(new Error('No edited image found in Qwen API response'));
                    } catch (error) {
                        reject(new Error(`Failed to parse Qwen edit response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Qwen edit API request failed: ${error.message}`));
            });

            req.write(requestBody);
            req.end();
        });
    }

    /**
     * Download image from URL to buffer
     * @param {string} imageUrl - URL of image to download
     * @returns {Promise<Buffer>} - Image buffer
     */
    async downloadImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const url = new URL(imageUrl);
            const client = url.protocol === 'https:' ? https : require('http');

            const req = client.get(imageUrl, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to download image: ${res.statusCode}`));
                    return;
                }

                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    const imageBuffer = Buffer.concat(chunks);
                    resolve(imageBuffer);
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Image download request failed: ${error.message}`));
            });

            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Image download timeout'));
            });
        });
    }

    /**
     * Generate character-consistent image with adjustable control strength
     * This method provides multiple attempts with different control strengths for optimal character consistency
     * @param {string} prompt - The text prompt for image generation
     * @param {Buffer} referenceImage - Reference image buffer
     * @param {Object} options - Additional options including controlStrength
     * @returns {Promise<Buffer>} - Image buffer
     */
    async generateCharacterConsistentImage(prompt, referenceImage, options = {}) {
        const controlStrengths = options.controlStrength ? [options.controlStrength] : [0.8, 0.6, 0.4];
        const lastError = null;

        for (let i = 0; i < controlStrengths.length; i++) {
            const strength = controlStrengths[i];
            console.log(`Attempt ${i + 1}/${controlStrengths.length}: Using control strength ${strength}`);

            try {
                const imageBuffer = await this.generateImageWithControlNet(
                    prompt,
                    referenceImage,
                    {
                        ...options,
                        controlStrength: strength.toString(),
                        negativePrompt: options.negativePrompt || 'blurry, bad quality, distorted, different character, changed appearance, different face'
                    }
                );
                console.log(`✓ Control strength ${strength} successful`);
                return imageBuffer;
            } catch (error) {
                console.log(`✗ Control strength ${strength} failed: ${error.message}`);
                lastError = error;
                continue;
            }
        }

        // If all control strengths fail, throw the last error
        throw lastError || new Error('All control strength attempts failed');
    }

    /**
     * Generate character-consistent image using Qwen two-step approach
     * Step 1: Generate base image with Qwen text-to-image
     * Step 2: Edit image with Qwen-image-edit to add character
     * @param {string} prompt - The text prompt for image generation
     * @param {Buffer} characterPortrait - Character portrait buffer
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} - Final edited image buffer
     */
    async generateCharacterConsistentImageWithQwen(prompt, characterPortrait, options = {}) {
        try {
            console.log('Step 1: Generating base image with Qwen text-to-image...');
            console.log('Prompt:', prompt);

            // Step 1: Generate base image using Qwen text-to-image
            const baseImageBuffer = await this.generateImageWithQwen(prompt, {
                style: options.style,
                negativePrompt: options.negativePrompt || 'blurry, bad quality, distorted, disfigured',
                size: '1328*1328'
            });

            console.log('Step 1 completed: Base image generated');

            // Upload base image to temporary location to get URL
            const tempKey = `temp/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
            const tempImageUrl = await this.uploadToS3(baseImageBuffer, tempKey);

            console.log('Step 2: Editing image with Qwen-image-edit to add character...');

            // Step 2: Edit the image to add character using Qwen-image-edit
            const finalImageBuffer = await this.editImageWithQwen(
                prompt,
                tempImageUrl,
                characterPortrait,
                {
                    negativePrompt: 'blurry, bad quality, distorted, different character, changed appearance, different face'
                }
            );

            console.log('Step 2 completed: Character added to image');
            console.log('Qwen two-step character consistency successful');

            return finalImageBuffer;
        } catch (error) {
            console.error('Qwen two-step generation failed:', error.message);
            throw error;
        }
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
                        // Use Qwen two-step approach as primary method for character consistency
                        console.log('Using Qwen two-step approach for character consistency...');
                        imageBuffer = await this.generateCharacterConsistentImageWithQwen(
                            englishPrompt,
                            referenceImage,
                            {
                                style,
                                negativePrompt: 'blurry, bad quality, distorted, different character'
                            }
                        );
                        console.log('Qwen two-step approach successful');
                    } catch (qwenError) {
                        console.log('Qwen two-step approach failed, falling back to Stability AI Structure API:', qwenError.message);

                        try {
                            // Fallback to enhanced Structure API if Qwen fails
                            imageBuffer = await this.generateCharacterConsistentImage(
                                englishPrompt,
                                referenceImage,
                                {
                                    style,
                                    negativePrompt: 'blurry, bad quality, distorted, different character'
                                }
                            );
                            console.log('Fallback to Structure API successful');
                        } catch (structureError) {
                            console.log('Structure API failed, using image-to-image fallback:', structureError.message);

                            // Final fallback to image-to-image if Qwen and Structure API fail
                            imageBuffer = await this.generateImageWithReference(
                                englishPrompt,
                                referenceImage,
                                { style }
                            );
                        }
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