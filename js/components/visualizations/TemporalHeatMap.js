/**
 * Temporal Heat Map System
 * Creates dynamic heat maps showing event density across space and time
 *
 * Features:
 * - Event density visualization
 * - Time-based heat map evolution
 * - Multiple heat map modes (density, importance, activity)
 * - Smooth animations and transitions
 * - Configurable time windows and granularity
 * - Interactive heat map controls
 */

class TemporalHeatMap {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            enabled: options.enabled !== false,
            mode: options.mode || 'density', // 'density', 'importance', 'activity', 'participants'
            timeWindow: options.timeWindow || 100, // cycles to look back/forward
            granularity: options.granularity || 10, // spatial grid size in map units
            intensity: options.intensity || 0.8,
            radius: options.radius || 50, // heat point radius in pixels
            animationDuration: options.animationDuration || 800,
            updateInterval: options.updateInterval || 200, // ms during animation
            showLegend: options.showLegend !== false,
            ...options
        };

        this.currentCycle = 0;
        this.heatMapLayer = null;
        this.heatPoints = [];
        this.animationTimer = null;
        this.eventCache = new Map();
        this.legendElement = null;

        // Heat map modes configuration
        this.heatModes = {
            density: {
                name: 'Event Density',
                description: 'Shows concentration of historical events',
                colorGradient: {
                    0.0: 'rgba(0, 0, 255, 0)',     // Transparent
                    0.2: 'rgba(0, 255, 255, 0.3)', // Cyan
                    0.4: 'rgba(0, 255, 0, 0.5)',   // Green
                    0.6: 'rgba(255, 255, 0, 0.7)', // Yellow
                    0.8: 'rgba(255, 165, 0, 0.8)', // Orange
                    1.0: 'rgba(255, 0, 0, 0.9)'    // Red
                },
                valueCalculator: (events) => events.length
            },
            importance: {
                name: 'Historical Importance',
                description: 'Shows significance of events in each area',
                colorGradient: {
                    0.0: 'rgba(128, 0, 128, 0)',     // Transparent
                    0.2: 'rgba(75, 0, 130, 0.3)',    // Indigo
                    0.4: 'rgba(138, 43, 226, 0.5)',  // Blue Violet
                    0.6: 'rgba(186, 85, 211, 0.7)',  // Medium Orchid
                    0.8: 'rgba(218, 112, 214, 0.8)', // Plum
                    1.0: 'rgba(255, 20, 147, 0.9)'   // Deep Pink
                },
                valueCalculator: (events) => {
                    return events.reduce((sum, event) => sum + (event.importance || 0), 0) / events.length || 0;
                }
            },
            activity: {
                name: 'Temporal Activity',
                description: 'Shows how active different periods were',
                colorGradient: {
                    0.0: 'rgba(0, 100, 0, 0)',      // Transparent
                    0.2: 'rgba(34, 139, 34, 0.3)',  // Forest Green
                    0.4: 'rgba(50, 205, 50, 0.5)',  // Lime Green
                    0.6: 'rgba(124, 252, 0, 0.7)',  // Lawn Green
                    0.8: 'rgba(173, 255, 47, 0.8)', // Green Yellow
                    1.0: 'rgba(255, 255, 0, 0.9)'   // Yellow
                },
                valueCalculator: (events) => {
                    // Calculate activity based on event frequency and duration
                    const totalDuration = events.reduce((sum, event) => {
                        const duration = event.cycle_end ?
                            (event.cycle_end - event.cycle_start) : 1;
                        return sum + duration;
                    }, 0);
                    return Math.min(totalDuration / 10, 10); // Normalize to 0-10 scale
                }
            },
            participants: {
                name: 'Participant Networks',
                description: 'Shows areas with high participant involvement',
                colorGradient: {
                    0.0: 'rgba(255, 140, 0, 0)',     // Transparent
                    0.2: 'rgba(255, 165, 0, 0.3)',   // Orange
                    0.4: 'rgba(255, 215, 0, 0.5)',   // Gold
                    0.6: 'rgba(255, 255, 224, 0.7)', // Light Yellow
                    0.8: 'rgba(255, 250, 205, 0.8)', // Lemon Chiffon
                    1.0: 'rgba(255, 255, 255, 0.9)'  // White
                },
                valueCalculator: (events) => {
                    const participantCount = events.reduce((sum, event) => {
                        const participants = event.participants || [];
                        return sum + (Array.isArray(participants) ? participants.length :
                                     (typeof participants === 'string' ?
                                      JSON.parse(participants || '[]').length : 0));
                    }, 0);
                    return Math.min(participantCount / 5, 10); // Normalize
                }
            }
        };

        this.init();
    }

    init() {
        this.createHeatMapLayer();
        if (this.options.showLegend) {
            this.createLegend();
        }

        if (this.options.enabled) {
            this.enable();
        }
    }

    createHeatMapLayer() {
        // Create Leaflet heat layer using a plugin or custom implementation
        this.heatMapLayer = L.layerGroup();
        this.heatMapLayer.addTo(this.map);
    }

    createLegend() {
        this.legendElement = L.control({ position: 'bottomright' });

        this.legendElement.onAdd = () => {
            const div = L.DomUtil.create('div', 'heat-map-legend');
            div.innerHTML = this.generateLegendHTML();
            return div;
        };

        this.legendElement.addTo(this.map);
    }

    generateLegendHTML() {
        const mode = this.heatModes[this.options.mode];
        const gradient = mode.colorGradient;

        let html = `
            <div class="legend-header">
                <h4>${mode.name}</h4>
                <p>${mode.description}</p>
            </div>
            <div class="legend-gradient">
        `;

        // Create gradient bar
        const gradientStops = Object.keys(gradient)
            .map(stop => `${gradient[stop]} ${parseFloat(stop) * 100}%`)
            .join(', ');

        html += `
                <div class="gradient-bar" style="background: linear-gradient(to right, ${gradientStops});"></div>
                <div class="gradient-labels">
                    <span>Low</span>
                    <span>High</span>
                </div>
            </div>
        `;

        return html;
    }

    async updateHeatMap(currentCycle, animate = true) {
        this.currentCycle = currentCycle;

        if (animate && this.animationTimer) {
            clearInterval(this.animationTimer);
        }

        try {
            // Load events for the current time window
            const events = await this.loadEventsForTimeWindow(currentCycle);

            if (animate) {
                this.animateHeatMapUpdate(events);
            } else {
                this.renderHeatMap(events);
            }
        } catch (error) {
            console.error('Error updating heat map:', error);
        }
    }

    async loadEventsForTimeWindow(currentCycle) {
        const cacheKey = `${currentCycle}-${this.options.timeWindow}-${this.options.mode}`;

        if (this.eventCache.has(cacheKey)) {
            return this.eventCache.get(cacheKey);
        }

        const startCycle = currentCycle - this.options.timeWindow;
        const endCycle = currentCycle + this.options.timeWindow;

        try {
            const response = await fetch(
                `/api/temporal/events?cycle_start=${startCycle}&cycle_end=${endCycle}`
            );
            const data = await response.json();

            if (data.success) {
                // Filter events that have spatial coordinates
                const spatialEvents = data.events.filter(event =>
                    event.latitude !== null && event.longitude !== null
                );

                this.eventCache.set(cacheKey, spatialEvents);
                return spatialEvents;
            }
        } catch (error) {
            console.error('Error loading events for heat map:', error);
        }

        return [];
    }

    animateHeatMapUpdate(events) {
        let startTime = Date.now();
        let previousIntensity = 0;

        this.animationTimer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / this.options.animationDuration, 1);
            const easedProgress = this.easeInOutQuad(progress);

            // Gradually build up the heat map
            const currentIntensity = easedProgress * this.options.intensity;
            this.renderHeatMap(events, currentIntensity);

            if (progress >= 1) {
                clearInterval(this.animationTimer);
                this.animationTimer = null;
            }
        }, this.options.updateInterval);
    }

    renderHeatMap(events, intensityOverride = null) {
        // Clear existing heat points
        this.heatMapLayer.clearLayers();
        this.heatPoints = [];

        if (!events || events.length === 0) return;

        // Group events by spatial proximity
        const spatialGroups = this.groupEventsSpatially(events);
        const intensity = intensityOverride !== null ? intensityOverride : this.options.intensity;

        // Create heat points for each spatial group
        spatialGroups.forEach(group => {
            const heatValue = this.calculateHeatValue(group.events);
            const normalizedValue = this.normalizeHeatValue(heatValue, spatialGroups);

            if (normalizedValue > 0.01) { // Only show significant heat points
                this.createHeatPoint(group.center, normalizedValue, intensity, group.events);
            }
        });

        // Update legend if needed
        if (this.legendElement && this.options.showLegend) {
            this.updateLegend();
        }
    }

    groupEventsSpatially(events) {
        const groups = [];
        const gridSize = this.options.granularity;

        // Create spatial grid
        const eventsByGrid = new Map();

        events.forEach(event => {
            const gridX = Math.floor(event.latitude / gridSize) * gridSize;
            const gridY = Math.floor(event.longitude / gridSize) * gridSize;
            const gridKey = `${gridX},${gridY}`;

            if (!eventsByGrid.has(gridKey)) {
                eventsByGrid.set(gridKey, {
                    center: { lat: gridX + gridSize/2, lng: gridY + gridSize/2 },
                    events: []
                });
            }

            eventsByGrid.get(gridKey).events.push(event);
        });

        return Array.from(eventsByGrid.values());
    }

    calculateHeatValue(events) {
        const mode = this.heatModes[this.options.mode];
        return mode.valueCalculator(events);
    }

    normalizeHeatValue(value, allGroups) {
        if (allGroups.length === 0) return 0;

        const allValues = allGroups.map(group => this.calculateHeatValue(group.events));
        const maxValue = Math.max(...allValues);
        const minValue = Math.min(...allValues);

        if (maxValue === minValue) return maxValue > 0 ? 1 : 0;

        return (value - minValue) / (maxValue - minValue);
    }

    createHeatPoint(center, normalizedValue, intensity, events) {
        const mode = this.heatModes[this.options.mode];
        const gradient = mode.colorGradient;

        // Find the appropriate color based on normalized value
        const color = this.interpolateColor(gradient, normalizedValue);
        const finalOpacity = this.extractOpacity(color) * intensity;

        // Create circular heat point
        const heatPoint = L.circle([center.lat, center.lng], {
            radius: this.options.radius * Math.sqrt(normalizedValue) * 1000, // Convert to meters
            fillColor: this.setColorOpacity(color, finalOpacity),
            color: 'transparent',
            fillOpacity: finalOpacity,
            interactive: true
        });

        // Add popup with heat point information
        const eventCount = events.length;
        const heatValue = this.calculateHeatValue(events);
        const popupContent = this.generateHeatPointPopup(mode, eventCount, heatValue, events);

        heatPoint.bindPopup(popupContent);
        heatPoint.addTo(this.heatMapLayer);

        this.heatPoints.push({
            layer: heatPoint,
            value: normalizedValue,
            events: events,
            center: center
        });
    }

    generateHeatPointPopup(mode, eventCount, heatValue, events) {
        const timeRange = this.getEventTimeRange(events);
        const topEvents = events
            .sort((a, b) => (b.importance || 0) - (a.importance || 0))
            .slice(0, 3);

        return `
            <div class="heat-point-popup">
                <h4>${mode.name} Hotspot</h4>
                <div class="heat-stats">
                    <div class="stat">
                        <span class="label">Events:</span>
                        <span class="value">${eventCount}</span>
                    </div>
                    <div class="stat">
                        <span class="label">${mode.name}:</span>
                        <span class="value">${heatValue.toFixed(1)}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Time Range:</span>
                        <span class="value">${timeRange}</span>
                    </div>
                </div>
                <div class="top-events">
                    <h5>Key Events:</h5>
                    ${topEvents.map(event => `
                        <div class="event-item">
                            <strong>${event.title}</strong>
                            <small>(${event.formatted_time})</small>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    getEventTimeRange(events) {
        if (events.length === 0) return 'No events';

        const cycles = events.map(e => e.cycle_start).sort((a, b) => a - b);
        const minCycle = cycles[0];
        const maxCycle = cycles[cycles.length - 1];

        if (minCycle === maxCycle) {
            return `Cycle ${minCycle}`;
        }

        return `Cycles ${minCycle} to ${maxCycle}`;
    }

    interpolateColor(gradient, value) {
        const stops = Object.keys(gradient).map(parseFloat).sort((a, b) => a - b);

        if (value <= stops[0]) return gradient[stops[0]];
        if (value >= stops[stops.length - 1]) return gradient[stops[stops.length - 1]];

        // Find surrounding stops
        let lowerStop = stops[0];
        let upperStop = stops[stops.length - 1];

        for (let i = 0; i < stops.length - 1; i++) {
            if (value >= stops[i] && value <= stops[i + 1]) {
                lowerStop = stops[i];
                upperStop = stops[i + 1];
                break;
            }
        }

        // Interpolate between colors
        const factor = (value - lowerStop) / (upperStop - lowerStop);
        return this.blendColors(gradient[lowerStop], gradient[upperStop], factor);
    }

    blendColors(color1, color2, factor) {
        // Simple color blending - in production, could use more sophisticated color space
        // For now, return the closer color
        return factor < 0.5 ? color1 : color2;
    }

    extractOpacity(colorString) {
        const match = colorString.match(/rgba?\([^)]*,\s*([0-9.]+)\)/);
        return match ? parseFloat(match[1]) : 1;
    }

    setColorOpacity(colorString, opacity) {
        return colorString.replace(/rgba?\(([^)]*),\s*[0-9.]+\)/, `rgba($1, ${opacity})`);
    }

    updateLegend() {
        if (!this.legendElement) return;

        const container = this.legendElement.getContainer();
        if (container) {
            container.innerHTML = this.generateLegendHTML();
        }
    }

    // Utility functions
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // Public API methods
    setMode(mode) {
        if (this.heatModes[mode]) {
            this.options.mode = mode;
            this.updateHeatMap(this.currentCycle, false);
        }
    }

    setIntensity(intensity) {
        this.options.intensity = Math.max(0, Math.min(1, intensity));
        this.updateHeatMap(this.currentCycle, false);
    }

    setTimeWindow(cycles) {
        this.options.timeWindow = Math.max(1, cycles);
        this.eventCache.clear(); // Clear cache as time window changed
        this.updateHeatMap(this.currentCycle, true);
    }

    setRadius(radius) {
        this.options.radius = Math.max(10, radius);
        this.updateHeatMap(this.currentCycle, false);
    }

    enable() {
        this.options.enabled = true;
        if (this.heatMapLayer && !this.map.hasLayer(this.heatMapLayer)) {
            this.heatMapLayer.addTo(this.map);
        }
        if (this.legendElement && !this.map.hasControl(this.legendElement)) {
            this.legendElement.addTo(this.map);
        }
    }

    disable() {
        this.options.enabled = false;
        if (this.heatMapLayer) {
            this.map.removeLayer(this.heatMapLayer);
        }
        if (this.legendElement) {
            this.map.removeControl(this.legendElement);
        }
    }

    isEnabled() {
        return this.options.enabled;
    }

    getHeatPoints() {
        return this.heatPoints;
    }

    getModes() {
        return Object.keys(this.heatModes);
    }

    getCurrentMode() {
        return this.options.mode;
    }

    clearCache() {
        this.eventCache.clear();
    }

    destroy() {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
        }

        if (this.heatMapLayer) {
            this.map.removeLayer(this.heatMapLayer);
        }

        if (this.legendElement) {
            this.map.removeControl(this.legendElement);
        }

        this.eventCache.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemporalHeatMap;
}