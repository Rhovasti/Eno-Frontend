/**
 * Epoch Overlay System
 * Provides visual epoch/era overlays on the temporal map with smooth transitions
 *
 * Features:
 * - Dynamic era coloring based on current time
 * - Smooth color transitions between epochs
 * - Visual intensity based on event density
 * - Animated epoch changes during time travel
 * - Customizable era definitions and colors
 */

class EpochOverlaySystem {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            enableOverlays: options.enableOverlays !== false,
            animationDuration: options.animationDuration || 1000, // ms
            intensityMultiplier: options.intensityMultiplier || 0.7,
            updateInterval: options.updateInterval || 100, // ms during animation
            showEraLabels: options.showEraLabels !== false,
            ...options
        };

        this.currentEpoch = null;
        this.targetEpoch = null;
        this.animationProgress = 0;
        this.animationTimer = null;
        this.overlayLayer = null;
        this.labelMarkers = [];

        // Era definitions with enhanced properties
        this.epochs = [
            {
                name: 'Ancient Past',
                cycleStart: -10000,
                cycleEnd: -1000,
                color: '#8e44ad',
                description: 'The dawn of civilization and mythological ages',
                intensity: 0.8,
                pattern: 'mystical',
                landmarks: ['Primordial Ruins', 'Ancient Temples', 'Lost Cities']
            },
            {
                name: 'Age of Foundations',
                cycleStart: -1000,
                cycleEnd: -100,
                color: '#2980b9',
                description: 'Great cities and nations were founded',
                intensity: 0.7,
                pattern: 'building',
                landmarks: ['First Citystates', 'Trade Routes', 'Early Kingdoms']
            },
            {
                name: 'Before Era',
                cycleStart: -100,
                cycleEnd: 0,
                color: '#16a085',
                description: 'The century before the current reckoning',
                intensity: 0.6,
                pattern: 'transition',
                landmarks: ['Border Conflicts', 'Cultural Exchange', 'Political Alliances']
            },
            {
                name: 'Current Era',
                cycleStart: 0,
                cycleEnd: 1000,
                color: '#27ae60',
                description: 'The present age of recorded history',
                intensity: 0.5,
                pattern: 'documented',
                landmarks: ['Modern Cities', 'Established Trade', 'Known History']
            },
            {
                name: 'Near Future',
                cycleStart: 1000,
                cycleEnd: 2000,
                color: '#f39c12',
                description: 'Prophesied and potential future events',
                intensity: 0.4,
                pattern: 'prophetic',
                landmarks: ['Predicted Events', 'Future Conflicts', 'Destiny Points']
            }
        ];

        this.init();
    }

    init() {
        this.createOverlayLayer();
        this.setupEraLabels();

        if (this.options.enableOverlays) {
            this.enableOverlays();
        }
    }

    createOverlayLayer() {
        // Create a custom layer for epoch overlays
        this.overlayLayer = L.layerGroup();
        this.overlayLayer.addTo(this.map);
    }

    setupEraLabels() {
        if (!this.options.showEraLabels) return;

        // Create era label markers that appear in different regions
        this.epochs.forEach((epoch, index) => {
            const labelPosition = this.getEraLabelPosition(index);

            const label = L.marker(labelPosition, {
                icon: L.divIcon({
                    className: 'era-label-marker',
                    html: `
                        <div class="era-label" data-era="${epoch.name.toLowerCase().replace(/\s+/g, '-')}">
                            <div class="era-name">${epoch.name}</div>
                            <div class="era-timespan">${this.formatCycleRange(epoch.cycleStart, epoch.cycleEnd)}</div>
                        </div>
                    `,
                    iconSize: [200, 60],
                    iconAnchor: [100, 30]
                }),
                interactive: false,
                opacity: 0
            });

            label.addTo(this.map);
            this.labelMarkers.push({
                marker: label,
                epoch: epoch
            });
        });
    }

    getEraLabelPosition(index) {
        // Distribute era labels across the map
        const positions = [
            [-60, -120],  // Ancient Past - Southwest
            [-30, -60],   // Age of Foundations - Northwest
            [0, 0],       // Before Era - Center
            [30, 60],     // Current Era - Northeast
            [60, 120]     // Near Future - Far East
        ];
        return positions[index] || [0, 0];
    }

    formatCycleRange(start, end) {
        if (start === end) return `Cycle ${start}`;
        return `Cycles ${start} to ${end}`;
    }

    enableOverlays() {
        this.overlayLayer.addTo(this.map);
    }

    disableOverlays() {
        this.map.removeLayer(this.overlayLayer);
    }

    updateEpochDisplay(currentCycle, animate = true) {
        const newEpoch = this.getEpochForCycle(currentCycle);

        if (newEpoch === this.currentEpoch && !animate) return;

        if (animate && newEpoch !== this.currentEpoch) {
            this.animateEpochTransition(this.currentEpoch, newEpoch);
        } else {
            this.setEpochImmediate(newEpoch);
        }

        this.updateEraLabels(newEpoch);
        this.currentEpoch = newEpoch;
    }

    getEpochForCycle(cycle) {
        return this.epochs.find(epoch =>
            cycle >= epoch.cycleStart && cycle < epoch.cycleEnd
        ) || this.epochs[this.epochs.length - 1]; // Default to last epoch if beyond range
    }

    animateEpochTransition(fromEpoch, toEpoch) {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
        }

        this.targetEpoch = toEpoch;
        this.animationProgress = 0;

        const startTime = Date.now();

        this.animationTimer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            this.animationProgress = Math.min(elapsed / this.options.animationDuration, 1);

            this.renderEpochTransition(fromEpoch, toEpoch, this.animationProgress);

            if (this.animationProgress >= 1) {
                clearInterval(this.animationTimer);
                this.animationTimer = null;
                this.setEpochImmediate(toEpoch);
            }
        }, this.options.updateInterval);
    }

    renderEpochTransition(fromEpoch, toEpoch, progress) {
        if (!fromEpoch || !toEpoch) return;

        // Smooth color interpolation using easing
        const easedProgress = this.easeInOutCubic(progress);
        const blendedColor = this.blendColors(fromEpoch.color, toEpoch.color, easedProgress);
        const blendedIntensity = this.lerp(fromEpoch.intensity, toEpoch.intensity, easedProgress);

        this.applyEpochOverlay(blendedColor, blendedIntensity);
    }

    setEpochImmediate(epoch) {
        if (!epoch) return;
        this.applyEpochOverlay(epoch.color, epoch.intensity);
    }

    applyEpochOverlay(color, intensity) {
        // Create atmospheric overlay effect
        this.overlayLayer.clearLayers();

        // Create multiple overlay circles for atmospheric effect
        const bounds = this.map.getBounds();
        const center = bounds.getCenter();

        // Main atmosphere overlay
        const atmosphereRadius = this.calculateOverlayRadius();

        const overlay = L.circle(center, {
            radius: atmosphereRadius,
            fillColor: color,
            fillOpacity: intensity * this.options.intensityMultiplier,
            color: color,
            opacity: 0.3,
            weight: 2,
            interactive: false
        });

        overlay.addTo(this.overlayLayer);

        // Add subtle gradient effect with multiple circles
        for (let i = 1; i <= 3; i++) {
            const gradientOverlay = L.circle(center, {
                radius: atmosphereRadius * (0.3 + i * 0.2),
                fillColor: color,
                fillOpacity: (intensity * 0.1) / i,
                color: 'transparent',
                interactive: false
            });
            gradientOverlay.addTo(this.overlayLayer);
        }
    }

    calculateOverlayRadius() {
        // Calculate radius based on current map bounds
        const bounds = this.map.getBounds();
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();

        // Convert to approximate meters (rough calculation)
        const latDiff = Math.abs(northEast.lat - southWest.lat);
        const lngDiff = Math.abs(northEast.lng - southWest.lng);

        // Return radius to cover most of visible area
        return Math.max(latDiff, lngDiff) * 111000 * 0.7; // Convert to meters and reduce
    }

    updateEraLabels(currentEpoch) {
        this.labelMarkers.forEach(({ marker, epoch }) => {
            const isActive = epoch === currentEpoch;
            const opacity = isActive ? 1 : 0.3;

            marker.setOpacity(opacity);

            // Add special styling for active era
            const labelElement = marker.getElement();
            if (labelElement) {
                const label = labelElement.querySelector('.era-label');
                if (label) {
                    label.classList.toggle('active', isActive);
                }
            }
        });
    }

    // Utility functions for animations
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    lerp(start, end, progress) {
        return start + (end - start) * progress;
    }

    blendColors(color1, color2, progress) {
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);

        if (!rgb1 || !rgb2) return color1;

        const r = Math.round(this.lerp(rgb1.r, rgb2.r, progress));
        const g = Math.round(this.lerp(rgb1.g, rgb2.g, progress));
        const b = Math.round(this.lerp(rgb1.b, rgb2.b, progress));

        return this.rgbToHex(r, g, b);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(r, g, b) {
        return "#" + [r, g, b].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        }).join("");
    }

    // Public API methods
    setEpochOverlayEnabled(enabled) {
        this.options.enableOverlays = enabled;
        if (enabled) {
            this.enableOverlays();
            if (this.currentEpoch) {
                this.setEpochImmediate(this.currentEpoch);
            }
        } else {
            this.disableOverlays();
        }
    }

    setEraLabelsEnabled(enabled) {
        this.options.showEraLabels = enabled;
        this.labelMarkers.forEach(({ marker }) => {
            if (enabled) {
                marker.addTo(this.map);
            } else {
                this.map.removeLayer(marker);
            }
        });
    }

    getCurrentEpoch() {
        return this.currentEpoch;
    }

    getEpochInfo(cycle) {
        return this.getEpochForCycle(cycle);
    }

    getEpochsInTimeRange(startCycle, endCycle) {
        return this.epochs.filter(epoch =>
            epoch.cycleStart < endCycle && epoch.cycleEnd > startCycle
        );
    }

    setIntensity(intensity) {
        this.options.intensityMultiplier = Math.max(0, Math.min(1, intensity));
        if (this.currentEpoch) {
            this.setEpochImmediate(this.currentEpoch);
        }
    }

    // Advanced visualization features
    showEpochBoundaries(showBoundaries = true) {
        if (showBoundaries) {
            this.createEpochBoundaryMarkers();
        } else {
            this.removeEpochBoundaryMarkers();
        }
    }

    createEpochBoundaryMarkers() {
        this.epochs.forEach((epoch, index) => {
            if (index === 0) return; // Skip first epoch

            const boundaryMarker = L.marker([index * 20 - 60, 0], {
                icon: L.divIcon({
                    className: 'epoch-boundary-marker',
                    html: `
                        <div class="boundary-line" style="border-color: ${epoch.color};">
                            <div class="boundary-label">Cycle ${epoch.cycleStart}</div>
                        </div>
                    `,
                    iconSize: [100, 20],
                    iconAnchor: [50, 10]
                }),
                interactive: false
            });

            boundaryMarker.addTo(this.overlayLayer);
        });
    }

    removeEpochBoundaryMarkers() {
        // Remove boundary markers (they're part of overlayLayer)
        this.overlayLayer.eachLayer(layer => {
            if (layer.getElement && layer.getElement().querySelector('.epoch-boundary-marker')) {
                this.overlayLayer.removeLayer(layer);
            }
        });
    }

    destroy() {
        if (this.animationTimer) {
            clearInterval(this.animationTimer);
        }

        this.labelMarkers.forEach(({ marker }) => {
            this.map.removeLayer(marker);
        });

        if (this.overlayLayer) {
            this.map.removeLayer(this.overlayLayer);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EpochOverlaySystem;
}