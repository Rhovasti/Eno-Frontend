/**
 * Character Journey Visualization System
 * Creates animated pathways showing character movements, relationships, and life events across space and time
 *
 * Features:
 * - Dynamic character journey paths with temporal progression
 * - Relationship visualization between characters
 * - Life event markers (birth, death, major events)
 * - Interactive character selection and filtering
 * - Animated journey playback synchronized with temporal controls
 * - Character influence zones and territories
 */

class CharacterJourneySystem {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            enableJourneys: options.enableJourneys !== false,
            showRelationships: options.showRelationships !== false,
            showLifeEvents: options.showLifeEvents !== false,
            animationSpeed: options.animationSpeed || 1,
            pathOpacity: options.pathOpacity || 0.7,
            pathWidth: options.pathWidth || 3,
            showInfluenceZones: options.showInfluenceZones || false,
            maxCharacters: options.maxCharacters || 50,
            timeWindow: options.timeWindow || 100, // cycles
            ...options
        };

        this.characters = new Map();
        this.journeyPaths = new Map();
        this.relationships = new Map();
        this.lifeEvents = new Map();
        this.influenceZones = new Map();

        this.journeyLayer = null;
        this.relationshipLayer = null;
        this.eventsLayer = null;
        this.influenceLayer = null;

        this.currentTime = { cycle: 0, day: 1 };
        this.selectedCharacters = new Set();
        this.animationTimer = null;
        this.isAnimating = false;

        // Character color palette
        this.colorPalette = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#e67e22', '#34495e', '#f1c40f', '#e91e63',
            '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4',
            '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b',
            '#ffc107', '#ff9800', '#ff5722', '#795548', '#607d8b'
        ];

        this.init();
    }

    init() {
        this.createLayers();
        this.setupEventListeners();

        if (this.options.enableJourneys) {
            this.loadCharacterData();
        }
    }

    createLayers() {
        // Create separate layers for different elements
        this.journeyLayer = L.layerGroup().addTo(this.map);
        this.relationshipLayer = L.layerGroup().addTo(this.map);
        this.eventsLayer = L.layerGroup().addTo(this.map);
        this.influenceLayer = L.layerGroup().addTo(this.map);
    }

    setupEventListeners() {
        // Listen for character selection events
        this.map.on('characterSelected', (e) => {
            this.selectCharacter(e.characterId);
        });

        this.map.on('characterDeselected', (e) => {
            this.deselectCharacter(e.characterId);
        });
    }

    async loadCharacterData() {
        try {
            // Load character data from the backend
            const response = await fetch('/api/characters/journeys');
            if (!response.ok) {
                throw new Error(`Failed to load character data: ${response.status}`);
            }

            const data = await response.json();
            this.processCharacterData(data);
        } catch (error) {
            console.warn('Could not load character data, using sample data:', error);
            this.loadSampleCharacterData();
        }
    }

    loadSampleCharacterData() {
        // Sample character journey data for demonstration
        const sampleCharacters = [
            {
                id: 'char_1',
                name: 'Elara the Wanderer',
                type: 'explorer',
                birthCycle: -50,
                deathCycle: 25,
                locations: [
                    { cycle: -50, lat: 45, lng: -120, event: 'birth', description: 'Born in mountain village' },
                    { cycle: -30, lat: 40, lng: -100, event: 'journey', description: 'Traveled to plains' },
                    { cycle: -20, lat: 35, lng: -80, event: 'discovery', description: 'Discovered ancient ruins' },
                    { cycle: -10, lat: 50, lng: -60, event: 'settlement', description: 'Founded new settlement' },
                    { cycle: 0, lat: 55, lng: -40, event: 'achievement', description: 'Became regional leader' },
                    { cycle: 25, lat: 60, lng: -20, event: 'death', description: 'Died defending the realm' }
                ],
                relationships: ['char_2', 'char_3'],
                influence: { radius: 50, peak: 0 }
            },
            {
                id: 'char_2',
                name: 'Marcus the Builder',
                type: 'architect',
                birthCycle: -40,
                deathCycle: 30,
                locations: [
                    { cycle: -40, lat: 42, lng: -110, event: 'birth', description: 'Born to craftsman family' },
                    { cycle: -25, lat: 40, lng: -100, event: 'meeting', description: 'Met Elara' },
                    { cycle: -15, lat: 48, lng: -65, event: 'construction', description: 'Built great bridge' },
                    { cycle: -5, lat: 52, lng: -45, event: 'masterwork', description: 'Designed capital city' },
                    { cycle: 10, lat: 58, lng: -25, event: 'honor', description: 'Received royal commission' },
                    { cycle: 30, lat: 60, lng: -15, event: 'death', description: 'Completed final monument' }
                ],
                relationships: ['char_1', 'char_4'],
                influence: { radius: 30, peak: 10 }
            },
            {
                id: 'char_3',
                name: 'Sage Lyrian',
                type: 'scholar',
                birthCycle: -35,
                deathCycle: 40,
                locations: [
                    { cycle: -35, lat: 30, lng: -90, event: 'birth', description: 'Born in monastery' },
                    { cycle: -20, lat: 35, lng: -80, event: 'study', description: 'Studied ancient texts' },
                    { cycle: -10, lat: 45, lng: -70, event: 'teaching', description: 'Established academy' },
                    { cycle: 5, lat: 50, lng: -50, event: 'research', description: 'Major breakthrough' },
                    { cycle: 20, lat: 55, lng: -30, event: 'publication', description: 'Wrote seminal work' },
                    { cycle: 40, lat: 50, lng: -35, event: 'death', description: 'Died surrounded by students' }
                ],
                relationships: ['char_1', 'char_5'],
                influence: { radius: 40, peak: 20 }
            },
            {
                id: 'char_4',
                name: 'Captain Thorne',
                type: 'military',
                birthCycle: -30,
                deathCycle: 15,
                locations: [
                    { cycle: -30, lat: 38, lng: -95, event: 'birth', description: 'Born to soldier family' },
                    { cycle: -15, lat: 45, lng: -75, event: 'service', description: 'Joined royal guard' },
                    { cycle: -5, lat: 52, lng: -55, event: 'promotion', description: 'Became captain' },
                    { cycle: 5, lat: 48, lng: -40, event: 'victory', description: 'Won decisive battle' },
                    { cycle: 15, lat: 46, lng: -38, event: 'death', description: 'Fell in final campaign' }
                ],
                relationships: ['char_2'],
                influence: { radius: 35, peak: 5 }
            },
            {
                id: 'char_5',
                name: 'Elena the Healer',
                type: 'healer',
                birthCycle: -25,
                deathCycle: 45,
                locations: [
                    { cycle: -25, lat: 33, lng: -85, event: 'birth', description: 'Born with healing gift' },
                    { cycle: -10, lat: 40, lng: -75, event: 'training', description: 'Learned from master' },
                    { cycle: 0, lat: 47, lng: -60, event: 'practice', description: 'Opened healing house' },
                    { cycle: 15, lat: 53, lng: -45, event: 'miracle', description: 'Saved the plague victims' },
                    { cycle: 30, lat: 57, lng: -35, event: 'legacy', description: 'Trained new healers' },
                    { cycle: 45, lat: 55, lng: -40, event: 'death', description: 'Peaceful passing' }
                ],
                relationships: ['char_3'],
                influence: { radius: 25, peak: 15 }
            }
        ];

        this.processCharacterData({ characters: sampleCharacters });
    }

    processCharacterData(data) {
        data.characters.forEach((character, index) => {
            // Assign colors
            character.color = this.colorPalette[index % this.colorPalette.length];

            // Store character data
            this.characters.set(character.id, character);

            // Process journey path
            this.createJourneyPath(character);

            // Process life events
            this.createLifeEvents(character);

            // Process relationships
            this.processRelationships(character);

            // Create influence zones
            if (this.options.showInfluenceZones && character.influence) {
                this.createInfluenceZone(character);
            }
        });

        console.log(`Loaded ${data.characters.length} character journeys`);
    }

    createJourneyPath(character) {
        const pathCoordinates = character.locations.map(loc => [loc.lat, loc.lng]);

        // Create the main journey path
        const journeyPath = L.polyline(pathCoordinates, {
            color: character.color,
            weight: this.options.pathWidth,
            opacity: this.options.pathOpacity,
            dashArray: character.type === 'scholar' ? '10, 5' : null,
            interactive: true
        });

        // Add click handler for path selection
        journeyPath.on('click', () => {
            this.selectCharacter(character.id);
        });

        // Create tooltip for the path
        journeyPath.bindTooltip(`
            <div class="character-journey-tooltip">
                <h4>${character.name}</h4>
                <p><strong>Type:</strong> ${character.type}</p>
                <p><strong>Lifespan:</strong> Cycle ${character.birthCycle} - ${character.deathCycle}</p>
                <p><strong>Locations:</strong> ${character.locations.length} documented</p>
            </div>
        `, {
            className: 'character-journey-popup',
            sticky: true
        });

        journeyPath.addTo(this.journeyLayer);
        this.journeyPaths.set(character.id, journeyPath);
    }

    createLifeEvents(character) {
        const events = character.locations.map(location => {
            const marker = L.circleMarker([location.lat, location.lng], {
                radius: this.getEventRadius(location.event),
                fillColor: character.color,
                color: this.getEventColor(location.event),
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.6,
                interactive: true
            });

            // Add popup with event details
            marker.bindPopup(`
                <div class="life-event-popup">
                    <h4>${character.name}</h4>
                    <div class="event-time">Cycle ${location.cycle}</div>
                    <div class="event-type">${location.event}</div>
                    <p>${location.description}</p>
                </div>
            `);

            // Add click handler
            marker.on('click', () => {
                this.selectCharacter(character.id);
                this.highlightEvent(character.id, location.cycle);
            });

            return { marker, cycle: location.cycle, event: location };
        });

        this.lifeEvents.set(character.id, events);

        // Add markers to layer
        events.forEach(event => {
            event.marker.addTo(this.eventsLayer);
        });
    }

    getEventRadius(eventType) {
        const radiusMap = {
            'birth': 8,
            'death': 10,
            'achievement': 12,
            'discovery': 10,
            'meeting': 6,
            'journey': 5,
            'settlement': 9,
            'construction': 8,
            'teaching': 7,
            'victory': 11,
            'miracle': 12
        };
        return radiusMap[eventType] || 6;
    }

    getEventColor(eventType) {
        const colorMap = {
            'birth': '#2ecc71',
            'death': '#e74c3c',
            'achievement': '#f39c12',
            'discovery': '#9b59b6',
            'meeting': '#3498db',
            'journey': '#1abc9c',
            'settlement': '#e67e22',
            'construction': '#34495e',
            'teaching': '#f1c40f',
            'victory': '#e91e63',
            'miracle': '#00bcd4'
        };
        return colorMap[eventType] || '#95a5a6';
    }

    processRelationships(character) {
        if (!character.relationships) return;

        character.relationships.forEach(relatedCharId => {
            const relationshipId = [character.id, relatedCharId].sort().join('-');

            if (!this.relationships.has(relationshipId)) {
                this.relationships.set(relationshipId, {
                    characters: [character.id, relatedCharId],
                    strength: 1,
                    type: 'ally'
                });
            }
        });
    }

    createInfluenceZone(character) {
        if (!character.influence) return;

        const peakLocation = character.locations.find(loc => loc.cycle === character.influence.peak);
        if (!peakLocation) return;

        const influenceZone = L.circle([peakLocation.lat, peakLocation.lng], {
            radius: character.influence.radius * 1000, // Convert to meters
            fillColor: character.color,
            fillOpacity: 0.1,
            color: character.color,
            weight: 1,
            opacity: 0.3,
            interactive: false
        });

        influenceZone.addTo(this.influenceLayer);
        this.influenceZones.set(character.id, influenceZone);
    }

    selectCharacter(characterId) {
        if (this.selectedCharacters.has(characterId)) return;

        this.selectedCharacters.add(characterId);
        this.highlightCharacter(characterId, true);
        this.showRelationships(characterId);

        // Fire custom event
        this.map.fire('characterSelected', { characterId });
    }

    deselectCharacter(characterId) {
        if (!this.selectedCharacters.has(characterId)) return;

        this.selectedCharacters.delete(characterId);
        this.highlightCharacter(characterId, false);
        this.hideRelationships(characterId);

        // Fire custom event
        this.map.fire('characterDeselected', { characterId });
    }

    highlightCharacter(characterId, highlight = true) {
        const path = this.journeyPaths.get(characterId);
        const events = this.lifeEvents.get(characterId);
        const influence = this.influenceZones.get(characterId);

        if (path) {
            path.setStyle({
                weight: highlight ? this.options.pathWidth * 2 : this.options.pathWidth,
                opacity: highlight ? 1 : this.options.pathOpacity,
                zIndexOffset: highlight ? 1000 : 0
            });
        }

        if (events) {
            events.forEach(event => {
                const currentRadius = event.marker.getRadius();
                event.marker.setRadius(highlight ? currentRadius * 1.5 : currentRadius / 1.5);
                event.marker.setStyle({
                    opacity: highlight ? 1 : 0.8,
                    fillOpacity: highlight ? 0.8 : 0.6
                });
            });
        }

        if (influence) {
            influence.setStyle({
                fillOpacity: highlight ? 0.2 : 0.1,
                opacity: highlight ? 0.6 : 0.3
            });
        }
    }

    showRelationships(characterId) {
        if (!this.options.showRelationships) return;

        const character = this.characters.get(characterId);
        if (!character || !character.relationships) return;

        character.relationships.forEach(relatedCharId => {
            this.createRelationshipLine(characterId, relatedCharId);
        });
    }

    hideRelationships(characterId) {
        // Remove relationship lines involving this character
        this.relationshipLayer.eachLayer(layer => {
            if (layer.characterIds && layer.characterIds.includes(characterId)) {
                this.relationshipLayer.removeLayer(layer);
            }
        });
    }

    createRelationshipLine(charId1, charId2) {
        const char1 = this.characters.get(charId1);
        const char2 = this.characters.get(charId2);

        if (!char1 || !char2) return;

        // Find overlapping time period
        const overlapStart = Math.max(char1.birthCycle, char2.birthCycle);
        const overlapEnd = Math.min(char1.deathCycle, char2.deathCycle);

        if (overlapStart >= overlapEnd) return; // No overlap

        // Get positions during overlap period
        const char1Pos = this.getCharacterPositionAtTime(char1, overlapStart + (overlapEnd - overlapStart) / 2);
        const char2Pos = this.getCharacterPositionAtTime(char2, overlapStart + (overlapEnd - overlapStart) / 2);

        if (!char1Pos || !char2Pos) return;

        const relationshipLine = L.polyline([
            [char1Pos.lat, char1Pos.lng],
            [char2Pos.lat, char2Pos.lng]
        ], {
            color: '#95a5a6',
            weight: 2,
            opacity: 0.6,
            dashArray: '5, 10',
            interactive: false
        });

        relationshipLine.characterIds = [charId1, charId2];
        relationshipLine.addTo(this.relationshipLayer);
    }

    getCharacterPositionAtTime(character, cycle) {
        const locations = character.locations.sort((a, b) => a.cycle - b.cycle);

        // Find the location at or before the given cycle
        let beforeLocation = null;
        let afterLocation = null;

        for (let i = 0; i < locations.length; i++) {
            if (locations[i].cycle <= cycle) {
                beforeLocation = locations[i];
            }
            if (locations[i].cycle > cycle && !afterLocation) {
                afterLocation = locations[i];
                break;
            }
        }

        if (!beforeLocation) return locations[0];
        if (!afterLocation) return beforeLocation;

        // Interpolate between positions
        const progress = (cycle - beforeLocation.cycle) / (afterLocation.cycle - beforeLocation.cycle);
        return {
            lat: beforeLocation.lat + (afterLocation.lat - beforeLocation.lat) * progress,
            lng: beforeLocation.lng + (afterLocation.lng - beforeLocation.lng) * progress
        };
    }

    updateTimeDisplay(cycle, day) {
        this.currentTime = { cycle, day };
        this.updateVisibilityByTime();
    }

    updateVisibilityByTime() {
        const currentCycle = this.currentTime.cycle;
        const timeWindow = this.options.timeWindow;

        // Update character visibility based on current time
        this.characters.forEach((character, characterId) => {
            const isAlive = currentCycle >= character.birthCycle && currentCycle <= character.deathCycle;
            const isInTimeWindow = Math.abs(currentCycle - character.birthCycle) <= timeWindow ||
                                 Math.abs(currentCycle - character.deathCycle) <= timeWindow;

            const shouldShow = isAlive || isInTimeWindow;

            this.setCharacterVisibility(characterId, shouldShow);
        });
    }

    setCharacterVisibility(characterId, visible) {
        const path = this.journeyPaths.get(characterId);
        const events = this.lifeEvents.get(characterId);
        const influence = this.influenceZones.get(characterId);

        const opacity = visible ? (this.selectedCharacters.has(characterId) ? 1 : this.options.pathOpacity) : 0.1;

        if (path) {
            path.setStyle({ opacity });
        }

        if (events) {
            events.forEach(event => {
                const eventVisible = visible && Math.abs(this.currentTime.cycle - event.cycle) <= this.options.timeWindow / 2;
                event.marker.setStyle({
                    opacity: eventVisible ? 0.8 : 0.1,
                    fillOpacity: eventVisible ? 0.6 : 0.1
                });
            });
        }

        if (influence) {
            influence.setStyle({
                opacity: visible ? 0.3 : 0.05,
                fillOpacity: visible ? 0.1 : 0.02
            });
        }
    }

    highlightEvent(characterId, cycle) {
        const events = this.lifeEvents.get(characterId);
        if (!events) return;

        events.forEach(event => {
            if (event.cycle === cycle) {
                event.marker.setStyle({
                    radius: event.marker.getRadius() * 1.5,
                    opacity: 1,
                    fillOpacity: 0.9
                });

                // Reset after animation
                setTimeout(() => {
                    event.marker.setStyle({
                        radius: event.marker.getRadius() / 1.5,
                        opacity: 0.8,
                        fillOpacity: 0.6
                    });
                }, 1000);
            }
        });
    }

    // Animation controls
    playJourneyAnimation(characterId, speed = 1) {
        if (this.isAnimating) return;

        const character = this.characters.get(characterId);
        if (!character) return;

        this.isAnimating = true;
        let currentIndex = 0;
        const locations = character.locations.sort((a, b) => a.cycle - b.cycle);

        const animate = () => {
            if (currentIndex >= locations.length) {
                this.isAnimating = false;
                return;
            }

            const location = locations[currentIndex];

            // Pan map to location
            this.map.panTo([location.lat, location.lng], {
                duration: 1 / speed
            });

            // Highlight current location
            this.highlightEvent(characterId, location.cycle);

            currentIndex++;
            this.animationTimer = setTimeout(animate, 2000 / speed);
        };

        animate();
    }

    stopAnimation() {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
        this.isAnimating = false;
    }

    // Public API methods
    setJourneysEnabled(enabled) {
        this.options.enableJourneys = enabled;
        if (enabled) {
            this.journeyLayer.addTo(this.map);
            this.eventsLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.journeyLayer);
            this.map.removeLayer(this.eventsLayer);
        }
    }

    setRelationshipsEnabled(enabled) {
        this.options.showRelationships = enabled;
        if (enabled) {
            this.relationshipLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.relationshipLayer);
        }
    }

    setInfluenceZonesEnabled(enabled) {
        this.options.showInfluenceZones = enabled;
        if (enabled) {
            this.influenceLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.influenceLayer);
        }
    }

    setPathOpacity(opacity) {
        this.options.pathOpacity = Math.max(0, Math.min(1, opacity));
        this.journeyPaths.forEach(path => {
            if (!this.selectedCharacters.has(path.characterId)) {
                path.setStyle({ opacity: this.options.pathOpacity });
            }
        });
    }

    setTimeWindow(window) {
        this.options.timeWindow = Math.max(10, Math.min(1000, window));
        this.updateVisibilityByTime();
    }

    getCharacterList() {
        return Array.from(this.characters.values()).map(char => ({
            id: char.id,
            name: char.name,
            type: char.type,
            lifespan: `${char.birthCycle} - ${char.deathCycle}`,
            selected: this.selectedCharacters.has(char.id)
        }));
    }

    selectAllCharacters() {
        this.characters.forEach((char, id) => {
            this.selectCharacter(id);
        });
    }

    deselectAllCharacters() {
        Array.from(this.selectedCharacters).forEach(id => {
            this.deselectCharacter(id);
        });
    }

    getStats() {
        return {
            totalCharacters: this.characters.size,
            selectedCharacters: this.selectedCharacters.size,
            totalJourneys: this.journeyPaths.size,
            totalEvents: Array.from(this.lifeEvents.values()).reduce((sum, events) => sum + events.length, 0),
            totalRelationships: this.relationships.size,
            currentTimeWindow: this.options.timeWindow,
            isAnimating: this.isAnimating
        };
    }

    destroy() {
        this.stopAnimation();

        if (this.journeyLayer) this.map.removeLayer(this.journeyLayer);
        if (this.relationshipLayer) this.map.removeLayer(this.relationshipLayer);
        if (this.eventsLayer) this.map.removeLayer(this.eventsLayer);
        if (this.influenceLayer) this.map.removeLayer(this.influenceLayer);

        this.characters.clear();
        this.journeyPaths.clear();
        this.relationships.clear();
        this.lifeEvents.clear();
        this.influenceZones.clear();
        this.selectedCharacters.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterJourneySystem;
}