/**
 * AudioPlayer - Simple audio playback component for Eno Frontend
 * Handles audio file playback with controls
 */

class AudioPlayer {
    constructor(audioUrl, options = {}) {
        this.audioUrl = audioUrl;
        this.options = {
            autoplay: false,
            showDownload: true,
            prompt: options.prompt || '',
            audioType: options.audioType || '',
            duration: options.duration || 0,
            showSpeed: true,  // Show playback speed control
            enableKeyboardShortcuts: true,
            ...options
        };

        this.audioElement = null;
        this.container = null;
        this.isPlaying = false;

        // Load saved volume preference
        const savedVolume = localStorage.getItem('audioVolume');
        this.savedVolume = savedVolume ? parseFloat(savedVolume) : 1.0;
    }

    /**
     * Create and return the audio player HTML element
     */
    create() {
        this.container = document.createElement('div');
        this.container.className = 'audio-player-container';

        // Create audio element
        this.audioElement = document.createElement('audio');
        this.audioElement.className = 'audio-element';
        this.audioElement.preload = 'metadata';
        this.audioElement.src = this.audioUrl;

        // Create controls UI
        const controlsHTML = `
            <div class="audio-player-controls">
                <button class="audio-play-btn" title="Play/Pause">
                    <span class="play-icon">▶</span>
                    <span class="pause-icon" style="display:none;">⏸</span>
                </button>
                <div class="audio-progress-container">
                    <div class="audio-progress-bar">
                        <div class="audio-progress-fill"></div>
                    </div>
                    <div class="audio-time">
                        <span class="audio-current-time">0:00</span>
                        <span class="audio-separator">/</span>
                        <span class="audio-duration">0:00</span>
                    </div>
                </div>
                <div class="audio-volume-container">
                    <button class="audio-volume-btn" title="Mute/Unmute">🔊</button>
                    <input type="range" class="audio-volume-slider" min="0" max="100" value="${Math.round(this.savedVolume * 100)}" title="Volume">
                </div>
                ${this.options.showSpeed ? `
                <div class="audio-speed-container">
                    <select class="audio-speed-selector" title="Playback Speed">
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                </div>
                ` : ''}
                ${this.options.showDownload ? `
                <a href="${this.audioUrl}" download class="audio-download-btn" title="Download">⬇️</a>
                ` : ''}
            </div>
        `;

        // Add audio info if provided
        if (this.options.prompt || this.options.audioType) {
            const infoHTML = `
                <div class="audio-info-badge">
                    🎵 ${this.options.audioType || 'Audio'}
                    ${this.options.prompt ? `: ${this.options.prompt}` : ''}
                </div>
            `;
            this.container.innerHTML = infoHTML + controlsHTML;
        } else {
            this.container.innerHTML = controlsHTML;
        }

        this.container.appendChild(this.audioElement);

        // Apply saved volume
        this.audioElement.volume = this.savedVolume;

        // Attach event listeners
        this.attachEventListeners();

        return this.container;
    }

    attachEventListeners() {
        const playBtn = this.container.querySelector('.audio-play-btn');
        const progressBar = this.container.querySelector('.audio-progress-bar');
        const volumeBtn = this.container.querySelector('.audio-volume-btn');
        const volumeSlider = this.container.querySelector('.audio-volume-slider');
        const speedSelector = this.container.querySelector('.audio-speed-selector');

        // Play/Pause
        playBtn.addEventListener('click', () => this.togglePlay());

        // Progress bar click
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.seek(percent);
        });

        // Volume
        volumeBtn.addEventListener('click', () => this.toggleMute());
        volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));

        // Playback speed
        if (speedSelector) {
            speedSelector.addEventListener('change', (e) => this.setPlaybackSpeed(parseFloat(e.target.value)));
        }

        // Keyboard shortcuts (if enabled)
        if (this.options.enableKeyboardShortcuts) {
            this.setupKeyboardShortcuts();
        }

        // Audio element events
        this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
        this.audioElement.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audioElement.addEventListener('play', () => this.onPlay());
        this.audioElement.addEventListener('pause', () => this.onPause());
        this.audioElement.addEventListener('ended', () => this.onEnded());
        this.audioElement.addEventListener('error', (e) => this.onError(e));
    }

    togglePlay() {
        if (this.audioElement.paused) {
            this.play();
        } else {
            this.pause();
        }
    }

    play() {
        this.audioElement.play().catch(error => {
            console.error('Error playing audio:', error);
            this.showError('Failed to play audio');
        });
    }

    pause() {
        this.audioElement.pause();
    }

    seek(percent) {
        const time = percent * this.audioElement.duration;
        this.audioElement.currentTime = time;
    }

    setVolume(volume) {
        this.audioElement.volume = Math.max(0, Math.min(1, volume));
        this.updateVolumeIcon();
        // Persist volume preference
        localStorage.setItem('audioVolume', volume.toString());
    }

    setPlaybackSpeed(speed) {
        this.audioElement.playbackRate = speed;
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when audio player is in focus or playing
            if (!this.container.contains(document.activeElement) && !this.isPlaying) {
                return;
            }

            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.audioElement.currentTime = Math.max(0, this.audioElement.currentTime - 5);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.audioElement.currentTime = Math.min(this.audioElement.duration, this.audioElement.currentTime + 5);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.setVolume(Math.min(1, this.audioElement.volume + 0.1));
                    // Update volume slider
                    const volumeSlider = this.container.querySelector('.audio-volume-slider');
                    if (volumeSlider) volumeSlider.value = Math.round(this.audioElement.volume * 100);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.setVolume(Math.max(0, this.audioElement.volume - 0.1));
                    // Update volume slider
                    const volumeSliderDown = this.container.querySelector('.audio-volume-slider');
                    if (volumeSliderDown) volumeSliderDown.value = Math.round(this.audioElement.volume * 100);
                    break;
                case 'KeyM':
                    e.preventDefault();
                    this.toggleMute();
                    break;
            }
        });
    }

    toggleMute() {
        this.audioElement.muted = !this.audioElement.muted;
        this.updateVolumeIcon();
    }

    updateProgress() {
        const percent = (this.audioElement.currentTime / this.audioElement.duration) * 100;
        const progressFill = this.container.querySelector('.audio-progress-fill');
        const currentTimeEl = this.container.querySelector('.audio-current-time');

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }

        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(this.audioElement.currentTime);
        }
    }

    updateDuration() {
        const durationEl = this.container.querySelector('.audio-duration');
        if (durationEl) {
            durationEl.textContent = this.formatTime(this.audioElement.duration);
        }
    }

    updateVolumeIcon() {
        const volumeBtn = this.container.querySelector('.audio-volume-btn');
        if (this.audioElement.muted || this.audioElement.volume === 0) {
            volumeBtn.textContent = '🔇';
        } else if (this.audioElement.volume < 0.5) {
            volumeBtn.textContent = '🔉';
        } else {
            volumeBtn.textContent = '🔊';
        }
    }

    onPlay() {
        this.isPlaying = true;
        const playIcon = this.container.querySelector('.play-icon');
        const pauseIcon = this.container.querySelector('.pause-icon');
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'inline';
    }

    onPause() {
        this.isPlaying = false;
        const playIcon = this.container.querySelector('.play-icon');
        const pauseIcon = this.container.querySelector('.pause-icon');
        playIcon.style.display = 'inline';
        pauseIcon.style.display = 'none';
    }

    onEnded() {
        this.onPause();
        this.audioElement.currentTime = 0;
    }

    onError(e) {
        console.error('Audio error:', e);
        this.showError('Failed to load audio');
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'audio-error';
        errorDiv.textContent = `⚠️ ${message}`;
        this.container.appendChild(errorDiv);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    destroy() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
        }
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Make AudioPlayer globally available
if (typeof window !== 'undefined') {
    window.AudioPlayer = AudioPlayer;
}
