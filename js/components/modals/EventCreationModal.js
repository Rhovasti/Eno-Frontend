/**
 * Event Creation Modal Component
 * Provides interface for creating new temporal events with spatial and temporal coordinates
 *
 * Features:
 * - Time picker with cycle/day selection
 * - Location picker with map coordinates
 * - Event type, importance, and participants
 * - Duration support (start/end times)
 * - Validation and error handling
 * - Integration with temporal API
 */

class EventCreationModal {
    constructor(options = {}) {
        this.options = {
            onEventCreated: options.onEventCreated || null,
            onCancel: options.onCancel || null,
            initialLocation: options.initialLocation || null, // { lat, lon, type, id }
            initialTime: options.initialTime || null, // { cycle, day }
            parentElement: options.parentElement || document.body,
            ...options
        };

        this.isVisible = false;
        this.mapInstance = null;
        this.selectedLocation = this.options.initialLocation || null;
        this.selectedMarker = null;

        this.eventTypes = [
            { value: 'battle', label: 'Battle', icon: '⚔️', color: '#e74c3c' },
            { value: 'founding', label: 'City/Nation Founding', icon: '🏛️', color: '#3498db' },
            { value: 'treaty', label: 'Treaty/Agreement', icon: '🤝', color: '#2ecc71' },
            { value: 'birth', label: 'Birth', icon: '👶', color: '#f39c12' },
            { value: 'death', label: 'Death', icon: '💀', color: '#95a5a6' },
            { value: 'discovery', label: 'Discovery', icon: '🔍', color: '#9b59b6' },
            { value: 'trade', label: 'Trade Event', icon: '💰', color: '#f1c40f' },
            { value: 'disaster', label: 'Natural Disaster', icon: '🌪️', color: '#e67e22' },
            { value: 'cultural', label: 'Cultural Event', icon: '🎭', color: '#1abc9c' },
            { value: 'religious', label: 'Religious Event', icon: '⛪', color: '#8e44ad' },
            { value: 'political', label: 'Political Event', icon: '🏛️', color: '#34495e' },
            { value: 'other', label: 'Other', icon: '📍', color: '#7f8c8d' }
        ];

        this.locationTypes = [
            'citystate', 'region', 'landmark', 'battle_site', 'territory',
            'trade_route', 'settlement', 'fortress', 'temple', 'ruins'
        ];

        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        const modalHTML = `
            <div id="eventCreationModal" class="event-modal-overlay" style="display: none;">
                <div class="event-modal-container">
                    <div class="event-modal-header">
                        <h2>📍⏰ Create New Temporal Event</h2>
                        <button id="eventModalClose" class="modal-close-btn">&times;</button>
                    </div>

                    <div class="event-modal-body">
                        <!-- Progress Steps -->
                        <div class="modal-steps">
                            <div class="step active" data-step="1">
                                <span class="step-number">1</span>
                                <span class="step-label">Basic Info</span>
                            </div>
                            <div class="step" data-step="2">
                                <span class="step-number">2</span>
                                <span class="step-label">Time & Place</span>
                            </div>
                            <div class="step" data-step="3">
                                <span class="step-number">3</span>
                                <span class="step-label">Details</span>
                            </div>
                        </div>

                        <form id="eventCreationForm">
                            <!-- Step 1: Basic Information -->
                            <div class="step-content" data-step="1">
                                <div class="form-group">
                                    <label for="eventTitle">Event Title *</label>
                                    <input type="text" id="eventTitle" name="title" required
                                           placeholder="e.g., Battle of Red Plains, Founding of Malveiba">
                                    <div class="field-help">A descriptive name for this historical event</div>
                                </div>

                                <div class="form-group">
                                    <label for="eventType">Event Type *</label>
                                    <div class="event-type-grid">
                                        ${this.eventTypes.map(type => `
                                            <div class="event-type-option" data-type="${type.value}">
                                                <span class="type-icon" style="color: ${type.color}">${type.icon}</span>
                                                <span class="type-label">${type.label}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <input type="hidden" id="eventType" name="event_type" required>
                                </div>

                                <div class="form-group">
                                    <label for="eventImportance">Historical Importance</label>
                                    <div class="importance-slider-container">
                                        <input type="range" id="eventImportance" name="importance"
                                               min="1" max="10" value="5" class="importance-slider">
                                        <div class="importance-labels">
                                            <span>Minor (1)</span>
                                            <span id="importanceValue">Moderate (5)</span>
                                            <span>World-Changing (10)</span>
                                        </div>
                                    </div>
                                    <div class="field-help">How significant was this event in world history?</div>
                                </div>
                            </div>

                            <!-- Step 2: Time and Location -->
                            <div class="step-content" data-step="2" style="display: none;">
                                <!-- Time Selection -->
                                <div class="form-section">
                                    <h3>🕐 When did this happen?</h3>

                                    <div class="time-selection">
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label for="startCycle">Start Cycle *</label>
                                                <input type="number" id="startCycle" name="cycle_start" required
                                                       min="-10000" max="2000" value="0">
                                            </div>
                                            <div class="form-group">
                                                <label for="startDay">Start Day</label>
                                                <input type="number" id="startDay" name="day_start"
                                                       min="1" max="360" value="1">
                                            </div>
                                        </div>

                                        <div class="time-display">
                                            <div id="startTimeDisplay" class="time-preview">Cycle 0, Day 1</div>
                                        </div>

                                        <div class="duration-toggle">
                                            <label>
                                                <input type="checkbox" id="hasDuration" name="has_duration">
                                                This event lasted over time (has end date)
                                            </label>
                                        </div>

                                        <div id="endTimeSection" class="end-time-section" style="display: none;">
                                            <div class="form-row">
                                                <div class="form-group">
                                                    <label for="endCycle">End Cycle</label>
                                                    <input type="number" id="endCycle" name="cycle_end"
                                                           min="-10000" max="2000">
                                                </div>
                                                <div class="form-group">
                                                    <label for="endDay">End Day</label>
                                                    <input type="number" id="endDay" name="day_end"
                                                           min="1" max="360" value="1">
                                                </div>
                                            </div>
                                            <div class="time-display">
                                                <div id="endTimeDisplay" class="time-preview">Cycle 0, Day 1</div>
                                            </div>
                                        </div>

                                        <div class="time-helpers">
                                            <button type="button" id="setCurrentTime" class="helper-btn">
                                                Use Current Timeline Position
                                            </button>
                                            <button type="button" id="showTimeConverter" class="helper-btn">
                                                Time Converter Help
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Location Selection -->
                                <div class="form-section">
                                    <h3>📍 Where did this happen?</h3>

                                    <div class="location-selection">
                                        <div class="form-row">
                                            <div class="form-group">
                                                <label for="locationType">Location Type</label>
                                                <select id="locationType" name="location_type">
                                                    <option value="">Select type...</option>
                                                    ${this.locationTypes.map(type => `
                                                        <option value="${type}">${type.replace('_', ' ')}</option>
                                                    `).join('')}
                                                </select>
                                            </div>
                                            <div class="form-group">
                                                <label for="locationId">Location Name</label>
                                                <input type="text" id="locationId" name="location_id"
                                                       placeholder="e.g., malveiba, eastern_territories">
                                            </div>
                                        </div>

                                        <div class="coordinates-section">
                                            <div class="form-row">
                                                <div class="form-group">
                                                    <label for="latitude">Latitude</label>
                                                    <input type="number" id="latitude" name="latitude"
                                                           step="0.000001" placeholder="e.g., -34.43">
                                                </div>
                                                <div class="form-group">
                                                    <label for="longitude">Longitude</label>
                                                    <input type="number" id="longitude" name="longitude"
                                                           step="0.000001" placeholder="e.g., 31.9">
                                                </div>
                                            </div>

                                            <div class="location-helpers">
                                                <button type="button" id="useCurrentLocation" class="helper-btn">
                                                    Use Current Map Position
                                                </button>
                                                <button type="button" id="pickFromMap" class="helper-btn">
                                                    Pick Location on Map
                                                </button>
                                            </div>
                                        </div>

                                        <!-- Mini Map for Location Picking -->
                                        <div id="locationPickerMap" class="location-picker-map" style="display: none;">
                                            <div class="map-container">
                                                <div id="eventModalMap" style="height: 200px; width: 100%;"></div>
                                            </div>
                                            <div class="map-instructions">
                                                Click on the map to select the event location
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Step 3: Additional Details -->
                            <div class="step-content" data-step="3" style="display: none;">
                                <div class="form-group">
                                    <label for="eventDescription">Description</label>
                                    <textarea id="eventDescription" name="description" rows="4"
                                              placeholder="Describe what happened, the context, and the consequences..."></textarea>
                                    <div class="field-help">Provide historical context and details about the event</div>
                                </div>

                                <div class="form-group">
                                    <label for="eventParticipants">Participants</label>
                                    <div class="participants-input">
                                        <input type="text" id="participantInput" placeholder="Add participant (person, faction, etc.)">
                                        <button type="button" id="addParticipant" class="add-btn">Add</button>
                                    </div>
                                    <div id="participantsList" class="participants-list">
                                        <!-- Participants will be added here -->
                                    </div>
                                    <div class="field-help">Who was involved? (rulers, armies, factions, etc.)</div>
                                </div>

                                <div class="form-group">
                                    <label for="relatedEvents">Related Events</label>
                                    <div class="related-events-input">
                                        <input type="text" id="relatedEventInput" placeholder="Search for related events...">
                                        <button type="button" id="searchRelatedEvents" class="search-btn">Search</button>
                                    </div>
                                    <div id="relatedEventsList" class="related-events-list">
                                        <!-- Related events will be added here -->
                                    </div>
                                    <div class="field-help">Connect this event to other historical events</div>
                                </div>

                                <div class="form-group">
                                    <label for="eventGranularity">Time Granularity</label>
                                    <select id="eventGranularity" name="granularity">
                                        <option value="day">Day (precise date)</option>
                                        <option value="month">Month (approximate month)</option>
                                        <option value="season">Season (approximate season)</option>
                                        <option value="cycle">Cycle (sometime during the cycle)</option>
                                        <option value="decade">Decade (approximate decade)</option>
                                        <option value="century">Century (approximate century)</option>
                                        <option value="epoch">Epoch (approximate era)</option>
                                    </select>
                                    <div class="field-help">How precisely do we know when this happened?</div>
                                </div>

                                <div class="form-group">
                                    <label>
                                        <input type="checkbox" id="isOngoing" name="is_ongoing">
                                        This is an ongoing event (no end date)
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div class="event-modal-footer">
                        <div class="modal-actions">
                            <button type="button" id="modalPrevStep" class="btn btn-secondary" style="display: none;">
                                ← Previous
                            </button>
                            <button type="button" id="modalNextStep" class="btn btn-primary">
                                Next →
                            </button>
                            <button type="button" id="modalCancel" class="btn btn-cancel">
                                Cancel
                            </button>
                            <button type="submit" id="modalCreateEvent" class="btn btn-success" style="display: none;">
                                🎯 Create Event
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHTML;
        this.options.parentElement.appendChild(modalElement.firstElementChild);

        this.modalElement = document.getElementById('eventCreationModal');
        this.currentStep = 1;
        this.participants = [];
        this.relatedEvents = [];
    }

    setupEventListeners() {
        // Modal controls
        document.getElementById('eventModalClose').addEventListener('click', () => this.hide());
        document.getElementById('modalCancel').addEventListener('click', () => this.hide());

        // Step navigation
        document.getElementById('modalPrevStep').addEventListener('click', () => this.previousStep());
        document.getElementById('modalNextStep').addEventListener('click', () => this.nextStep());

        // Form submission
        document.getElementById('modalCreateEvent').addEventListener('click', (e) => {
            e.preventDefault();
            this.createEvent();
        });

        // Event type selection
        document.querySelectorAll('.event-type-option').forEach(option => {
            option.addEventListener('click', () => {
                document.querySelectorAll('.event-type-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                document.getElementById('eventType').value = option.dataset.type;
            });
        });

        // Importance slider
        const importanceSlider = document.getElementById('eventImportance');
        const importanceValue = document.getElementById('importanceValue');
        importanceSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            const labels = ['', 'Trivial', 'Minor', 'Local', 'Regional', 'Moderate', 'Significant', 'Major', 'Critical', 'Historic', 'World-Changing'];
            importanceValue.textContent = `${labels[value]} (${value})`;
        });

        // Duration toggle
        document.getElementById('hasDuration').addEventListener('change', (e) => {
            const endSection = document.getElementById('endTimeSection');
            endSection.style.display = e.target.checked ? 'block' : 'none';
        });

        // Time helpers
        document.getElementById('setCurrentTime').addEventListener('click', () => this.setCurrentTime());
        document.getElementById('showTimeConverter').addEventListener('click', () => this.showTimeConverter());

        // Location helpers
        document.getElementById('useCurrentLocation').addEventListener('click', () => this.useCurrentLocation());
        document.getElementById('pickFromMap').addEventListener('click', () => this.toggleLocationPicker());

        // Participants
        document.getElementById('addParticipant').addEventListener('click', () => this.addParticipant());
        document.getElementById('participantInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addParticipant();
            }
        });

        // Related events
        document.getElementById('searchRelatedEvents').addEventListener('click', () => this.searchRelatedEvents());

        // Time display updates
        ['startCycle', 'startDay', 'endCycle', 'endDay'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateTimeDisplays());
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    show(options = {}) {
        this.isVisible = true;
        this.modalElement.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // Set initial values if provided
        if (options.initialLocation) {
            this.setLocation(options.initialLocation);
        }

        if (options.initialTime) {
            this.setTime(options.initialTime);
        }

        // Focus first input
        setTimeout(() => {
            document.getElementById('eventTitle').focus();
        }, 100);
    }

    hide() {
        this.isVisible = false;
        this.modalElement.style.display = 'none';
        document.body.style.overflow = '';

        if (this.mapInstance) {
            this.mapInstance.remove();
            this.mapInstance = null;
        }

        if (this.options.onCancel) {
            this.options.onCancel();
        }
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            if (this.currentStep < 3) {
                this.currentStep++;
                this.updateStepDisplay();
            }
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStepDisplay();
        }
    }

    updateStepDisplay() {
        // Update step indicators
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.toggle('active', index + 1 === this.currentStep);
            step.classList.toggle('completed', index + 1 < this.currentStep);
        });

        // Show/hide step content
        document.querySelectorAll('.step-content').forEach((content, index) => {
            content.style.display = index + 1 === this.currentStep ? 'block' : 'none';
        });

        // Update navigation buttons
        const prevBtn = document.getElementById('modalPrevStep');
        const nextBtn = document.getElementById('modalNextStep');
        const createBtn = document.getElementById('modalCreateEvent');

        prevBtn.style.display = this.currentStep > 1 ? 'inline-block' : 'none';
        nextBtn.style.display = this.currentStep < 3 ? 'inline-block' : 'none';
        createBtn.style.display = this.currentStep === 3 ? 'inline-block' : 'none';
    }

    validateCurrentStep() {
        const form = document.getElementById('eventCreationForm');
        let isValid = true;

        if (this.currentStep === 1) {
            // Validate basic info
            const title = document.getElementById('eventTitle').value.trim();
            const eventType = document.getElementById('eventType').value;

            if (!title) {
                this.showFieldError('eventTitle', 'Event title is required');
                isValid = false;
            }

            if (!eventType) {
                this.showError('Please select an event type');
                isValid = false;
            }
        } else if (this.currentStep === 2) {
            // Validate time and location
            const startCycle = document.getElementById('startCycle').value;

            if (!startCycle) {
                this.showFieldError('startCycle', 'Start cycle is required');
                isValid = false;
            }

            // Check for valid time range if duration is set
            const hasDuration = document.getElementById('hasDuration').checked;
            if (hasDuration) {
                const endCycle = document.getElementById('endCycle').value;
                const startDay = parseInt(document.getElementById('startDay').value) || 1;
                const endDay = parseInt(document.getElementById('endDay').value) || 1;

                if (endCycle && parseInt(endCycle) < parseInt(startCycle)) {
                    this.showFieldError('endCycle', 'End cycle cannot be before start cycle');
                    isValid = false;
                } else if (parseInt(endCycle) === parseInt(startCycle) && endDay <= startDay) {
                    this.showFieldError('endDay', 'End day must be after start day in the same cycle');
                    isValid = false;
                }
            }
        }

        return isValid;
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        field.classList.add('error');

        // Remove existing error message
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        // Add error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);

        // Remove error after interaction
        field.addEventListener('input', () => {
            field.classList.remove('error');
            errorDiv.remove();
        }, { once: true });
    }

    showError(message) {
        // Create or update error display
        let errorDiv = this.modalElement.querySelector('.modal-error');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'modal-error';
            this.modalElement.querySelector('.event-modal-body').prepend(errorDiv);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }

    setLocation(location) {
        if (location.lat !== undefined) document.getElementById('latitude').value = location.lat;
        if (location.lon !== undefined) document.getElementById('longitude').value = location.lon;
        if (location.type) document.getElementById('locationType').value = location.type;
        if (location.id) document.getElementById('locationId').value = location.id;

        this.selectedLocation = location;
    }

    setTime(time) {
        if (time.cycle !== undefined) document.getElementById('startCycle').value = time.cycle;
        if (time.day !== undefined) document.getElementById('startDay').value = time.day;
        this.updateTimeDisplays();
    }

    setCurrentTime() {
        // Get current time from parent timeline if available
        if (window.temporalExtension && window.temporalExtension.getCurrentTime) {
            const currentTime = window.temporalExtension.getCurrentTime();
            this.setTime(currentTime);
        } else {
            // Default to cycle 0
            this.setTime({ cycle: 0, day: 1 });
        }
    }

    useCurrentLocation() {
        // Get current map center if available
        if (window.mapViewer && window.mapViewer.map) {
            const center = window.mapViewer.map.getCenter();
            this.setLocation({
                lat: center.lat,
                lon: center.lng
            });
        }
    }

    toggleLocationPicker() {
        const mapContainer = document.getElementById('locationPickerMap');
        if (mapContainer.style.display === 'none') {
            mapContainer.style.display = 'block';
            this.initLocationPickerMap();
        } else {
            mapContainer.style.display = 'none';
        }
    }

    initLocationPickerMap() {
        if (this.mapInstance) return;

        const mapElement = document.getElementById('eventModalMap');
        this.mapInstance = L.map(mapElement).setView([0, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.mapInstance);

        // Click to select location
        this.mapInstance.on('click', (e) => {
            if (this.selectedMarker) {
                this.mapInstance.removeLayer(this.selectedMarker);
            }

            this.selectedMarker = L.marker([e.latlng.lat, e.latlng.lng])
                .addTo(this.mapInstance)
                .bindPopup('Selected location')
                .openPopup();

            this.setLocation({
                lat: e.latlng.lat,
                lon: e.latlng.lng
            });
        });
    }

    updateTimeDisplays() {
        const startCycle = document.getElementById('startCycle').value;
        const startDay = document.getElementById('startDay').value || 1;
        const endCycle = document.getElementById('endCycle').value;
        const endDay = document.getElementById('endDay').value || 1;

        if (typeof timeConverter !== 'undefined') {
            if (startCycle) {
                document.getElementById('startTimeDisplay').textContent =
                    timeConverter.cycleToReadable(parseInt(startCycle), parseInt(startDay));
            }

            if (endCycle) {
                document.getElementById('endTimeDisplay').textContent =
                    timeConverter.cycleToReadable(parseInt(endCycle), parseInt(endDay));
            }
        }
    }

    showTimeConverter() {
        alert(`Time Converter Help:

Cycle System:
• 1 Cycle = 360 days = 12 months = 4 seasons
• 1 Month = 30 days
• 1 Season = 90 days

Eras:
• Ancient Past: -10,000 to -1,000 cycles
• Age of Foundations: -1,000 to -100 cycles
• Before Era: -100 to 0 cycles
• Current Era: 0 to 1,000 cycles
• Near Future: 1,000 to 2,000 cycles

Examples:
• Cycle 0, Day 1 = Current era beginning
• Cycle -500, Day 180 = Ancient past, mid-cycle
• Cycle 523, Day 145 = Current era, mid-summer`);
    }

    addParticipant() {
        const input = document.getElementById('participantInput');
        const participant = input.value.trim();

        if (participant && !this.participants.includes(participant)) {
            this.participants.push(participant);
            this.updateParticipantsList();
            input.value = '';
        }
    }

    updateParticipantsList() {
        const list = document.getElementById('participantsList');
        list.innerHTML = this.participants.map(participant => `
            <div class="participant-tag">
                <span>${participant}</span>
                <button type="button" class="remove-btn" onclick="eventModal.removeParticipant('${participant}')">×</button>
            </div>
        `).join('');
    }

    removeParticipant(participant) {
        this.participants = this.participants.filter(p => p !== participant);
        this.updateParticipantsList();
    }

    async searchRelatedEvents() {
        const query = document.getElementById('relatedEventInput').value.trim();
        if (!query) return;

        try {
            const response = await fetch(`/api/temporal/events/search?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.success) {
                this.displayRelatedEventsResults(data.events);
            }
        } catch (error) {
            console.error('Error searching related events:', error);
            this.showError('Failed to search for related events');
        }
    }

    displayRelatedEventsResults(events) {
        const list = document.getElementById('relatedEventsList');
        list.innerHTML = events.map(event => `
            <div class="related-event-result" data-event-id="${event.id}">
                <div class="event-info">
                    <strong>${event.title}</strong>
                    <small>${event.formatted_time} - ${event.event_type}</small>
                </div>
                <button type="button" class="add-relation-btn">Add Relation</button>
            </div>
        `).join('');

        // Add click handlers for relation buttons
        list.querySelectorAll('.add-relation-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = e.target.closest('.related-event-result').dataset.eventId;
                const eventInfo = events.find(ev => ev.id == eventId);
                this.addRelatedEvent(eventInfo);
            });
        });
    }

    addRelatedEvent(event) {
        if (!this.relatedEvents.find(e => e.id === event.id)) {
            this.relatedEvents.push(event);
            this.updateRelatedEventsList();
        }
    }

    updateRelatedEventsList() {
        const list = document.getElementById('relatedEventsList');
        const relatedHtml = this.relatedEvents.map(event => `
            <div class="related-event-tag">
                <span>${event.title} (${event.formatted_time})</span>
                <button type="button" class="remove-btn" onclick="eventModal.removeRelatedEvent(${event.id})">×</button>
            </div>
        `).join('');

        if (relatedHtml) {
            list.innerHTML = '<div class="related-events-selected">' + relatedHtml + '</div>';
        }
    }

    removeRelatedEvent(eventId) {
        this.relatedEvents = this.relatedEvents.filter(e => e.id !== eventId);
        this.updateRelatedEventsList();
    }

    async createEvent() {
        if (!this.validateCurrentStep()) return;

        const formData = new FormData(document.getElementById('eventCreationForm'));
        const eventData = {
            title: formData.get('title'),
            description: formData.get('description'),
            cycle_start: parseInt(formData.get('cycle_start')),
            day_start: parseInt(formData.get('day_start')) || 1,
            event_type: formData.get('event_type'),
            importance: parseInt(formData.get('importance')),
            granularity: formData.get('granularity'),
            is_ongoing: formData.get('is_ongoing') === 'on',
            participants: JSON.stringify(this.participants),
            related_events: JSON.stringify(this.relatedEvents.map(e => e.id))
        };

        // Add end time if duration is set
        if (document.getElementById('hasDuration').checked && formData.get('cycle_end')) {
            eventData.cycle_end = parseInt(formData.get('cycle_end'));
            eventData.day_end = parseInt(formData.get('day_end')) || 1;
        }

        // Add location if provided
        if (formData.get('latitude')) {
            eventData.latitude = parseFloat(formData.get('latitude'));
            eventData.longitude = parseFloat(formData.get('longitude'));
            eventData.location_type = formData.get('location_type') || null;
            eventData.location_id = formData.get('location_id') || null;
        }

        try {
            const response = await fetch('/api/temporal/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(eventData)
            });

            const result = await response.json();

            if (result.success) {
                this.hide();
                if (this.options.onEventCreated) {
                    this.options.onEventCreated(result.event);
                }
            } else {
                this.showError(result.message || 'Failed to create event');
            }
        } catch (error) {
            console.error('Error creating event:', error);
            this.showError('Failed to create event. Please try again.');
        }
    }

    // Public API
    destroy() {
        if (this.modalElement) {
            this.modalElement.remove();
        }
        if (this.mapInstance) {
            this.mapInstance.remove();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventCreationModal;
}