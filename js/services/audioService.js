const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const fs = require('fs').promises;

class AudioService {
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
     * Generate audio using Stability AI Stable Audio 2.5
     * @param {string} prompt - The text prompt for audio generation
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} - Audio buffer
     */
    async generateAudio(prompt, options = {}) {
        return new Promise((resolve, reject) => {
            // Stable Audio 2.5 endpoint - WORKING as of 2025-10-01
            const hostname = 'api.stability.ai';
            const path = '/v2beta/audio/stable-audio-2/text-to-audio';

            const FormData = require('form-data');
            const form = new FormData();

            // Required parameters for Stable Audio 2.5
            form.append('prompt', prompt);
            form.append('model', 'stable-audio-2.5'); // Stable Audio 2.5 model
            form.append('duration', options.duration || 30); // Duration in seconds
            form.append('output_format', 'mp3'); // MP3 for web compatibility

            // Note: Stable Audio 2.5 doesn't use audio_type or style parameters
            // The prompt should include all style/mood descriptions

            const requestOptions = {
                hostname: hostname,
                path: path,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.stabilityApiKey}`,
                    'Accept': 'audio/*',
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
                        reject(new Error(`Stable Audio 2.5 generation failed: ${res.statusCode} - ${errorData}`));
                    });
                    return;
                }

                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    try {
                        const audioBuffer = Buffer.concat(chunks);
                        resolve(audioBuffer);
                    } catch (error) {
                        reject(new Error(`Failed to process audio response: ${error.message}`));
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
     * Generate placeholder audio file (for testing until Stable Audio API is available)
     * @param {string} prompt - The text prompt for audio generation
     * @param {Object} options - Additional options
     * @returns {Promise<Buffer>} - Placeholder audio buffer
     */
    async generatePlaceholderAudio(prompt, options = {}) {
        // Generate a simple placeholder audio file
        // This would be replaced with actual Stable Audio generation when API is available
        const duration = options.duration || 30;
        const audioType = options.audioType || 'ambient';
        
        // For now, create a simple text-based "audio file" as placeholder
        // In reality, this would generate actual audio
        const placeholderContent = JSON.stringify({
            type: 'placeholder_audio',
            prompt: prompt,
            audioType: audioType,
            duration: duration,
            generated_at: new Date().toISOString(),
            note: 'This is a placeholder. Actual audio generation will be implemented when Stable Audio API is available.'
        });
        
        return Buffer.from(placeholderContent, 'utf8');
    }

    /**
     * Upload audio to S3
     * @param {Buffer} audioBuffer - Audio buffer to upload
     * @param {string} key - S3 object key
     * @param {string} contentType - MIME type of audio file
     * @returns {Promise<string>} - Public URL of uploaded audio
     */
    async uploadToS3(audioBuffer, key, contentType = 'audio/mpeg') {
        const params = {
            Bucket: this.bucketName,
            Key: key,
            Body: audioBuffer,
            ContentType: contentType
        };

        const result = await this.s3.upload(params).promise();
        // Construct public URL manually
        return `https://${this.bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    /**
     * Translate Finnish audio prompts to English
     * @param {string} text - Text to translate
     * @returns {string} - Translated text
     */
    translateAudioPromptToEnglish(text) {
        // Audio-specific Finnish to English translations
        const audioTranslations = {
            // Musical terms
            'musiikki': 'music',
            'taustamusiikki': 'background music',
            'tunnelmamusiikki': 'ambient music',
            'orkestri': 'orchestral',
            'piano': 'piano',
            'kitara': 'guitar',
            'viulu': 'violin',
            'rumpu': 'drums',
            
            // Mood/atmosphere
            'synkkä': 'dark',
            'iloinen': 'happy',
            'surullinen': 'sad',
            'jännittävä': 'tense',
            'rauhallinen': 'peaceful',
            'mystinen': 'mysterious',
            'pelottava': 'scary',
            'epätoivoinen': 'hopeless',
            'voitorikas': 'triumphant',
            
            // Environmental sounds
            'tuuli': 'wind',
            'sade': 'rain',
            'myrsky': 'storm',
            'metsä': 'forest',
            'meri': 'ocean',
            'lintujen laulu': 'birdsong',
            'askeleet': 'footsteps',
            'tuli': 'fire crackling',
            
            // Fantasy/game specific
            'taistelu': 'battle',
            'lohikäärme': 'dragon',
            'loitsu': 'spell casting',
            'miekkailu': 'sword fighting',
            'seikkailu': 'adventure',
            'linna': 'castle',
            'luola': 'cave echoes'
        };

        let translatedText = text.toLowerCase();
        
        // Replace Finnish words with English
        Object.keys(audioTranslations).forEach(finnish => {
            const english = audioTranslations[finnish];
            const regex = new RegExp(`\\b${finnish}\\b`, 'gi');
            translatedText = translatedText.replace(regex, english);
        });
        
        // If text is still mostly Finnish, add a generic audio prefix
        if (translatedText === text.toLowerCase()) {
            translatedText = `ambient sound for ${text}`;
        }
        
        return translatedText;
    }

    /**
     * Determine audio type based on prompt content
     * @param {string} prompt - The audio prompt
     * @returns {string} - Suggested audio type
     */
    determineAudioType(prompt) {
        const lowerPrompt = prompt.toLowerCase();

        // Music keywords
        if (lowerPrompt.includes('musiikki') || lowerPrompt.includes('music') ||
            lowerPrompt.includes('song') || lowerPrompt.includes('melody') ||
            lowerPrompt.includes('orkestri') || lowerPrompt.includes('piano')) {
            return 'music';
        }

        // Sound effects keywords
        if (lowerPrompt.includes('ääni') || lowerPrompt.includes('sound') ||
            lowerPrompt.includes('noise') || lowerPrompt.includes('effect') ||
            lowerPrompt.includes('askeleet') || lowerPrompt.includes('footsteps')) {
            return 'sfx';
        }

        // Default to ambient
        return 'ambient';
    }

    /**
     * Enhance audio prompt with style and type information for Stable Audio 2.5
     * Since the API doesn't have separate style parameters, we embed them in the prompt
     * @param {string} prompt - The base audio prompt
     * @param {Object} options - Style and type options
     * @returns {string} - Enhanced prompt
     */
    enhanceAudioPrompt(prompt, options = {}) {
        const { audioType, style } = options;

        // Style descriptors for different audio types
        const styleDescriptors = {
            orchestral: 'orchestral, cinematic, epic',
            cinematic: 'cinematic, dramatic, atmospheric',
            acoustic: 'acoustic, natural, organic',
            electronic: 'electronic, synthesized, modern',
            medieval: 'medieval, ancient, historical',
            dark: 'dark, ominous, mysterious'
        };

        // Type-specific enhancement
        let enhancedPrompt = prompt;

        // Add style descriptor if available
        if (style && styleDescriptors[style]) {
            enhancedPrompt = `${styleDescriptors[style]} ${enhancedPrompt}`;
        }

        // Add audio type context
        if (audioType === 'music') {
            enhancedPrompt = `musical composition: ${enhancedPrompt}`;
        } else if (audioType === 'sfx') {
            enhancedPrompt = `sound effect: ${enhancedPrompt}`;
        } else if (audioType === 'ambient') {
            enhancedPrompt = `ambient soundscape: ${enhancedPrompt}`;
        }

        return enhancedPrompt;
    }

    /**
     * Generate audio and upload to S3
     * @param {Object} params - Generation parameters
     * @returns {Promise<Object>} - URLs and metadata
     */
    async generateAndUpload(params) {
        const { prompt, gameId, postId, userId, audioType, style, duration } = params;
        
        try {
            // Translate prompt to English if needed
            const englishPrompt = this.translateAudioPromptToEnglish(prompt);
            console.log('Original audio prompt:', prompt);
            console.log('English audio prompt:', englishPrompt);
            
            // Enhance prompt with style information since Stable Audio 2.5
            // doesn't have separate style parameters
            const enhancedPrompt = this.enhanceAudioPrompt(englishPrompt, {
                audioType: audioType || this.determineAudioType(prompt),
                style: style || 'cinematic'
            });

            console.log('Enhanced prompt for Stable Audio 2.5:', enhancedPrompt);

            const options = {
                duration: duration || 30
            };

            // Generate with Stable Audio 2.5 API
            const audioBuffer = await this.generateAudio(enhancedPrompt, options);
            console.log('Stable Audio 2.5 generation successful');
            
            // Create S3 key
            const timestamp = Date.now();
            const audioId = uuidv4();
            const audioKey = `games/${gameId}/posts/${postId}/audio/${audioId}_${timestamp}.mp3`;
            
            // Upload to S3
            console.log('Uploading audio to S3...');
            const audioUrl = await this.uploadToS3(audioBuffer, audioKey, 'audio/mpeg');
            
            console.log('Audio uploaded successfully:', audioUrl);
            
            return {
                audioUrl: audioUrl,
                prompt: prompt, // Keep original prompt for display
                englishPrompt: englishPrompt, // Store translated prompt too
                metadata: {
                    audioId,
                    gameId,
                    postId,
                    userId,
                    timestamp,
                    audioType: options.audioType,
                    style: options.style,
                    duration: options.duration
                }
            };
        } catch (error) {
            console.error('Error in audio generateAndUpload:', error);
            throw error;
        }
    }

    /**
     * Test audio generation capability
     * @returns {Promise<boolean>} - True if generation works
     */
    async testAudioGeneration() {
        try {
            const testPrompt = "peaceful forest ambience";
            const audioBuffer = await this.generatePlaceholderAudio(testPrompt);
            return audioBuffer && audioBuffer.length > 0;
        } catch (error) {
            console.error('Audio generation test error:', error);
            return false;
        }
    }
}

module.exports = AudioService;