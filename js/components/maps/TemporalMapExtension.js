/**
 * Temporal Map Extension
 * Adds time controls to the unified map viewer for 4D visualization
 *
 * Features:
 * - Timeline scrubber at bottom
 * - Play/pause animation through time
 * - Speed controls
 * - Event markers appear/disappear based on current time
 * - "Time travel" mode
 */

class TemporalMapExtension {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            initialCycle: options.initialCycle || 0,
            animationSpeed: options.animationSpeed || 1, // cycles per second
            onTimeChange: options.onTimeChange || null,
            showHistoricalEvents: options.showHistoricalEvents !== false,
            ...options
        };

        this.currentCycle = this.options.initialCycle;
        this.currentDay = 1;
        this.isPlaying = false;
        this.animationInterval = null;
        this.animationSpeed = this.options.animationSpeed;

        this.temporalEvents = [];
        this.temporalMarkers = L.layerGroup();

        this.init();
    }

    init() {
        this.createTemporalControls();
        this.setupEventListeners();
        if (this.options.showHistoricalEvents) {
            this.loadTemporalEvents();
        }
    }

    createTemporalControls() {
        // Create temporal control panel
        const controlsHTML = `
            <div id="temporalControls" class="temporal-controls">
                <div class="temporal-header">
                    <h3>⏰ Time Travel Mode</h3>
                    <button id="toggleTemporal" class="toggle-btn">Hide Controls</button>
                </div>

                <div class="temporal-body">
                    <div class="time-display-large">
                        <div id="currentTimeDisplay" class="current-time">Cycle 0, Day 1</div>
                        <div id="currentEra" class="current-era">Now Era</div>
                    </div>

                    <div class="playback-controls">
                        <button id="playPause" class="control-btn" title="Play/Pause">
                            <span class="play-icon">▶</span>
                        </button>
                        <button id="stepBackward" class="control-btn" title="Step Backward">⏮</button>
                        <button id="stepForward" class="control-btn" title="Step Forward">⏭</button>
                        <button id="resetTime" class="control-btn" title="Reset to Now">🔄</button>
                    </div>

                    <div class="speed-control">
                        <label>
                            Speed:
                            <select id="speedControl">
                                <option value="0.1">0.1x (Slow)</option>
                                <option value="1" selected>1x (Normal)</option>
                                <option value="10">10x (Fast)</option>
                                <option value="100">100x (Very Fast)</option>
                                <option value="1000">1000x (Ultra Fast)</option>
                            </select>
                        </label>
                        <label>
                            Step Size:
                            <select id="stepSize">
                                <option value="1">1 Day</option>
                                <option value="30">1 Month</option>
                                <option value="90" selected>1 Season</option>
                                <option value="360">1 Cycle</option>
                                <option value="3600">10 Cycles</option>
                            </select>
                        </label>
                    </div>

                    <div class="timeline-scrubber">
                        <div class="scrubber-labels">
                            <span>-10000</span>
                            <span>-5000</span>
                            <span>0</span>
                            <span>500</span>
                            <span>1000</span>
                        </div>
                        <input type="range" id="timeScrubber"
                               min="-10000" max="1000" value="0" step="1">
                        <div id="scrubberMarker" class="scrubber-marker"></div>
                    </div>

                    <div class="temporal-filters">
                        <label>
                            <input type="checkbox" id="showTemporalEvents" checked>
                            Show Historical Events
                        </label>
                        <label>
                            <input type="checkbox" id="fadeOutdatedMarkers" checked>
                            Fade Outdated Markers
                        </label>
                    </div>

                    <div class="quick-jumps">
                        <button class="quick-jump-btn" data-cycle="-5000">Ancient Past</button>
                        <button class="quick-jump-btn" data-cycle="-500">Age of Foundations</button>
                        <button class="quick-jump-btn" data-cycle="0">Present Day</button>
                        <button class="quick-jump-btn" data-cycle="500">Near Future</button>
                    </div>
                </div>
            </div>
        `;

        // Add to map container
        const mapContainer = this.map.getContainer().parentElement;
        const controlsDiv = document.createElement('div');
        controlsDiv.innerHTML = controlsHTML;
        mapContainer.appendChild(controlsDiv.firstElementChild);

        // Add temporal markers layer to map
        this.temporalMarkers.addTo(this.map);
    }

    setupEventListeners() {
        // Play/Pause
        document.getElementById('playPause').addEventListener('click', () => {
            this.togglePlayback();
        });

        // Step controls
        document.getElementById('stepBackward').addEventListener('click', () => {
            this.stepTime(-1);
        });

        document.getElementById('stepForward').addEventListener('click', () => {
            this.stepTime(1);
        });

        // Reset
        document.getElementById('resetTime').addEventListener('click', () => {
            this.jumpToTime(0, 1);
        });

        // Speed control
        document.getElementById('speedControl').addEventListener('change', (e) => {
            this.animationSpeed = parseFloat(e.target.value);
        });

        // Timeline scrubber
        const scrubber = document.getElementById('timeScrubber');
        scrubber.addEventListener('input', (e) => {
            const cycle = parseInt(e.target.value);
            this.jumpToTime(cycle, 1);
        });

        // Quick jumps
        document.querySelectorAll('.quick-jump-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cycle = parseInt(e.target.getAttribute('data-cycle'));
                this.jumpToTime(cycle, 1);
            });
        });

        // Show/hide temporal events
        document.getElementById('showTemporalEvents').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.showTemporalEvents();
            } else {
                this.hideTemporalEvents();
            }
        });

        // Toggle controls
        document.getElementById('toggleTemporal').addEventListener('click', () => {
            const body = document.querySelector('.temporal-body');
            const btn = document.getElementById('toggleTemporal');
            if (body.style.display === 'none') {
                body.style.display = 'block';
                btn.textContent = 'Hide Controls';
            } else {
                body.style.display = 'none';
                btn.textContent = 'Show Controls';
            }
        });
    }

    async loadTemporalEvents() {
        try {
            const response = await fetch('/api/temporal/events?cycle_start=-10000&cycle_end=2000');
            const data = await response.json();
            if (data.success) {
                this.temporalEvents = data.events;
                this.updateTemporalMarkers();
            }
        } catch (error) {
            console.error('Error loading temporal events:', error);
        }
    }

    updateTemporalMarkers() {
        // Clear existing markers
        this.temporalMarkers.clearLayers();

        const fadeOutdated = document.getElementById('fadeOutdatedMarkers')?.checked;

        // Add markers for events that have occurred by current time
        this.temporalEvents.forEach(event => {
            const eventCycle = event.cycle_start + (event.day_start || 0) / 360;
            const eventEndCycle = event.cycle_end ? event.cycle_end + (event.day_end || 0) / 360 : null;

            // Check if event has occurred
            const hasOccurred = eventCycle <= this.currentCycle;
            const isOngoing = eventEndCycle === null || eventEndCycle >= this.currentCycle;

            if (!hasOccurred) return; // Event hasn't happened yet

            // Calculate opacity based on time
            let opacity = 1;
            if (fadeOutdated && !isOngoing) {
                const timeSince = this.currentCycle - eventCycle;
                opacity = Math.max(0.3, 1 - (timeSince / 1000)); // Fade over 1000 cycles
            }

            // Create marker
            if (event.latitude && event.longitude) {
                const color = this.getEventColor(event.event_type);
                const icon = this.getEventIcon(event.event_type);

                const marker = L.marker([event.latitude, event.longitude], {
                    icon: L.divIcon({
                        className: 'temporal-event-marker',
                        html: `
                            <div style="opacity: ${opacity}; background: ${color};
                                        color: white; border-radius: 50%;
                                        width: 30px; height: 30px;
                                        display: flex; align-items: center;
                                        justify-content: center; font-size: 16px;
                                        border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                                ${icon}
                            </div>
                        `,
                        iconSize: [30, 30]
                    })
                });

                marker.bindPopup(`
                    <div class="temporal-event-popup">
                        <h4>${icon} ${event.title}</h4>
                        <div class="event-time">${event.formatted_time}</div>
                        <div class="event-type">${event.event_type}</div>
                        ${event.description ? `<p>${event.description}</p>` : ''}
                        ${event.participants.length > 0 ?
                            `<div class="event-participants">
                                <strong>Participants:</strong> ${event.participants.join(', ')}
                            </div>` : ''}
                        <div class="event-importance">Importance: ${'⭐'.repeat(Math.min(event.importance, 10))}</div>
                    </div>
                `);

                marker.addTo(this.temporalMarkers);
            }
        });
    }

    getEventColor(eventType) {
        const colors = {
            battle: '#e74c3c',
            founding: '#3498db',
            treaty: '#2ecc71',
            birth: '#f39c12',
            death: '#95a5a6',
            discovery: '#9b59b6',
            default: '#34495e'
        };
        return colors[eventType] || colors.default;
    }

    getEventIcon(eventType) {
        const icons = {
            battle: '⚔️',
            founding: '🏛️',
            treaty: '🤝',
            birth: '👶',
            death: '💀',
            discovery: '🔍',
            default: '📍'
        };
        return icons[eventType] || icons.default;
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;
        document.querySelector('#playPause .play-icon').textContent = '⏸';

        // Animate forward in time
        this.animationInterval = setInterval(() => {
            const daysPerFrame = this.animationSpeed * (1000 / 60); // 60 fps
            this.currentDay += daysPerFrame;

            while (this.currentDay > 360) {
                this.currentDay -= 360;
                this.currentCycle += 1;
            }

            this.updateDisplay();
            this.updateTemporalMarkers();

            // Stop if we reach the future limit
            if (this.currentCycle > 2000) {
                this.pause();
            }
        }, 1000 / 60); // 60 fps
    }

    pause() {
        this.isPlaying = false;
        document.querySelector('#playPause .play-icon').textContent = '▶';

        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    stepTime(direction) {
        const stepSize = parseInt(document.getElementById('stepSize').value);
        this.currentDay += direction * stepSize;

        // Handle cycle boundaries
        while (this.currentDay > 360) {
            this.currentDay -= 360;
            this.currentCycle += 1;
        }
        while (this.currentDay < 1) {
            this.currentDay += 360;
            this.currentCycle -= 1;
        }

        // Clamp to valid range
        if (this.currentCycle < -10000) {
            this.currentCycle = -10000;
            this.currentDay = 1;
        }
        if (this.currentCycle > 2000) {
            this.currentCycle = 2000;
            this.currentDay = 360;
        }

        this.updateDisplay();
        this.updateTemporalMarkers();
    }

    jumpToTime(cycle, day = 1) {
        if (this.isPlaying) {
            this.pause();
        }

        this.currentCycle = cycle;
        this.currentDay = day;

        this.updateDisplay();
        this.updateTemporalMarkers();

        if (this.options.onTimeChange) {
            this.options.onTimeChange(cycle, day);
        }
    }

    updateDisplay() {
        // Update time display
        if (typeof timeConverter !== 'undefined') {
            const formatted = timeConverter.cycleToReadable(this.currentCycle, Math.floor(this.currentDay));
            document.getElementById('currentTimeDisplay').textContent = formatted;

            const era = timeConverter.getEra(this.currentCycle);
            document.getElementById('currentEra').textContent = era;
        } else {
            document.getElementById('currentTimeDisplay').textContent =
                `Cycle ${this.currentCycle}, Day ${Math.floor(this.currentDay)}`;
        }

        // Update scrubber position
        const scrubber = document.getElementById('timeScrubber');
        scrubber.value = this.currentCycle;

        // Update scrubber marker
        const min = parseFloat(scrubber.min);
        const max = parseFloat(scrubber.max);
        const percent = ((this.currentCycle - min) / (max - min)) * 100;
        const marker = document.getElementById('scrubberMarker');
        if (marker) {
            marker.style.left = `${percent}%`;
        }
    }

    showTemporalEvents() {
        if (!this.map.hasLayer(this.temporalMarkers)) {
            this.temporalMarkers.addTo(this.map);
        }
        this.updateTemporalMarkers();
    }

    hideTemporalEvents() {
        if (this.map.hasLayer(this.temporalMarkers)) {
            this.map.removeLayer(this.temporalMarkers);
        }
    }

    // Public API
    getCurrentTime() {
        return {
            cycle: this.currentCycle,
            day: Math.floor(this.currentDay)
        };
    }

    setTime(cycle, day = 1) {
        this.jumpToTime(cycle, day);
    }

    destroy() {
        this.pause();
        this.hideTemporalEvents();
        document.getElementById('temporalControls')?.remove();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemporalMapExtension;
}