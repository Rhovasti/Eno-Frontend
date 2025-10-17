/**
 * Historical Snapshot System
 * Captures, stores, and replays significant moments in world history with complete visual state preservation
 *
 * Features:
 * - Complete world state capture at key moments
 * - Visual bookmarking of important historical events
 * - Snapshot comparison and diff visualization
 * - Automated snapshot generation based on significance
 * - Manual snapshot creation and management
 * - Snapshot thumbnails and preview system
 * - Timeline integration with snapshot markers
 * - Export/import snapshot collections
 */

class HistoricalSnapshotSystem {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            enableSnapshots: options.enableSnapshots !== false,
            autoSnapshot: options.autoSnapshot !== false,
            maxSnapshots: options.maxSnapshots || 50,
            significanceThreshold: options.significanceThreshold || 0.7,
            previewSize: options.previewSize || { width: 200, height: 120 },
            compressionLevel: options.compressionLevel || 0.8,
            snapshotInterval: options.snapshotInterval || 100, // cycles
            ...options
        };

        this.snapshots = new Map();
        this.snapshotMarkers = new Map();
        this.currentSnapshot = null;
        this.isCapturing = false;
        this.isReplaying = false;

        this.snapshotLayer = null;
        this.previewContainer = null;
        this.snapshotTimeline = null;

        // Reference to other visualization systems for state capture
        this.visualizationSystems = new Map();

        // Snapshot categories
        this.categories = {
            'major_event': {
                name: 'Major Historical Event',
                color: '#e74c3c',
                icon: '⭐',
                priority: 10
            },
            'political_change': {
                name: 'Political Change',
                color: '#9b59b6',
                icon: '🏛️',
                priority: 8
            },
            'territorial_shift': {
                name: 'Territorial Change',
                color: '#3498db',
                icon: '🗺️',
                priority: 7
            },
            'character_milestone': {
                name: 'Character Milestone',
                color: '#2ecc71',
                icon: '👤',
                priority: 6
            },
            'cultural_moment': {
                name: 'Cultural Moment',
                color: '#f39c12',
                icon: '🎭',
                priority: 5
            },
            'economic_event': {
                name: 'Economic Event',
                color: '#1abc9c',
                icon: '💰',
                priority: 4
            },
            'milestone': {
                name: 'General Milestone',
                color: '#95a5a6',
                icon: '📍',
                priority: 3
            },
            'user_bookmark': {
                name: 'User Bookmark',
                color: '#34495e',
                icon: '🔖',
                priority: 2
            }
        };

        this.init();
    }

    init() {
        this.createSnapshotLayer();
        this.loadSnapshotData();
        this.setupAutoSnapshot();

        if (this.options.enableSnapshots) {
            this.enableSnapshots();
        }
    }

    createSnapshotLayer() {
        this.snapshotLayer = L.layerGroup().addTo(this.map);
    }

    registerVisualizationSystem(name, system) {
        this.visualizationSystems.set(name, system);
        console.log(`Registered visualization system: ${name}`);
    }

    async loadSnapshotData() {
        try {
            // Try to load existing snapshots from backend
            const response = await fetch('/api/snapshots/list');
            if (!response.ok) {
                throw new Error(`Failed to load snapshots: ${response.status}`);
            }

            const data = await response.json();
            this.processSnapshotData(data);
        } catch (error) {
            console.warn('Could not load snapshot data, using sample data:', error);
            this.loadSampleSnapshots();
        }
    }

    loadSampleSnapshots() {
        // Sample historical snapshots
        const sampleSnapshots = [
            {
                id: 'snapshot_001',
                timestamp: Date.now() - 86400000 * 30, // 30 days ago
                cycle: -100,
                day: 1,
                title: 'The Great Founding',
                description: 'Establishment of the Northern Kingdom and Southern Empire',
                category: 'major_event',
                significance: 1.0,
                created_by: 'system',
                worldState: {
                    territories: 'compressed_data_here',
                    characters: 'compressed_data_here',
                    events: 'compressed_data_here',
                    epoch: 'age-of-foundations'
                },
                thumbnail: null,
                tags: ['founding', 'political', 'kingdoms'],
                metrics: {
                    total_territories: 2,
                    total_characters: 8,
                    total_events: 15,
                    active_conflicts: 0
                }
            },
            {
                id: 'snapshot_002',
                timestamp: Date.now() - 86400000 * 20,
                cycle: -50,
                day: 15,
                title: 'Age of Expansion',
                description: 'Rapid territorial expansion across all major powers',
                category: 'territorial_shift',
                significance: 0.9,
                created_by: 'system',
                worldState: {
                    territories: 'compressed_data_here',
                    characters: 'compressed_data_here',
                    events: 'compressed_data_here',
                    epoch: 'age-of-foundations'
                },
                thumbnail: null,
                tags: ['expansion', 'growth', 'borders'],
                metrics: {
                    total_territories: 5,
                    total_characters: 12,
                    total_events: 28,
                    active_conflicts: 1
                }
            },
            {
                id: 'snapshot_003',
                timestamp: Date.now() - 86400000 * 10,
                cycle: -10,
                day: 3,
                title: 'The Great Conflict',
                description: 'Peak of tensions between Northern Kingdom and Southern Empire',
                category: 'major_event',
                significance: 0.95,
                created_by: 'auto',
                worldState: {
                    territories: 'compressed_data_here',
                    characters: 'compressed_data_here',
                    events: 'compressed_data_here',
                    epoch: 'before-era'
                },
                thumbnail: null,
                tags: ['conflict', 'war', 'diplomacy'],
                metrics: {
                    total_territories: 5,
                    total_characters: 15,
                    total_events: 45,
                    active_conflicts: 3
                }
            },
            {
                id: 'snapshot_004',
                timestamp: Date.now() - 86400000 * 5,
                cycle: 0,
                day: 1,
                title: 'The Current Era Begins',
                description: 'Dawn of the modern age with established borders and trade',
                category: 'milestone',
                significance: 0.8,
                created_by: 'system',
                worldState: {
                    territories: 'compressed_data_here',
                    characters: 'compressed_data_here',
                    events: 'compressed_data_here',
                    epoch: 'current-era'
                },
                thumbnail: null,
                tags: ['era', 'modern', 'stability'],
                metrics: {
                    total_territories: 5,
                    total_characters: 18,
                    total_events: 52,
                    active_conflicts: 1
                }
            },
            {
                id: 'snapshot_005',
                timestamp: Date.now() - 86400000 * 2,
                cycle: 25,
                day: 10,
                title: 'Heroes Rise',
                description: 'Key characters reach peak influence and power',
                category: 'character_milestone',
                significance: 0.75,
                created_by: 'user',
                worldState: {
                    territories: 'compressed_data_here',
                    characters: 'compressed_data_here',
                    events: 'compressed_data_here',
                    epoch: 'current-era'
                },
                thumbnail: null,
                tags: ['heroes', 'achievement', 'influence'],
                metrics: {
                    total_territories: 5,
                    total_characters: 20,
                    total_events: 68,
                    active_conflicts: 0
                }
            }
        ];

        this.processSnapshotData({ snapshots: sampleSnapshots });
    }

    processSnapshotData(data) {
        data.snapshots.forEach(snapshot => {
            this.snapshots.set(snapshot.id, snapshot);
            this.createSnapshotMarker(snapshot);
        });

        console.log(`Loaded ${data.snapshots.length} historical snapshots`);
        this.updateSnapshotTimeline();
    }

    createSnapshotMarker(snapshot) {
        const category = this.categories[snapshot.category] || this.categories.milestone;

        // Create timeline marker
        const marker = L.circleMarker([0, 0], {
            radius: 8 + (snapshot.significance * 4),
            fillColor: category.color,
            color: '#ffffff',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.8,
            interactive: true,
            className: `snapshot-marker snapshot-${snapshot.category}`
        });

        // Position marker based on cycle (not geographical location)
        const timelineY = -80; // Fixed Y position for timeline
        const timelineX = this.cycleToX(snapshot.cycle);
        marker.setLatLng([timelineY, timelineX]);

        // Create detailed popup
        marker.bindPopup(`
            <div class="snapshot-popup">
                <div class="snapshot-header">
                    <span class="snapshot-icon">${category.icon}</span>
                    <h4>${snapshot.title}</h4>
                </div>
                <div class="snapshot-meta">
                    <div class="snapshot-time">Cycle ${snapshot.cycle}, Day ${snapshot.day}</div>
                    <div class="snapshot-category">${category.name}</div>
                    <div class="snapshot-significance">Significance: ${Math.round(snapshot.significance * 100)}%</div>
                </div>
                <div class="snapshot-description">${snapshot.description}</div>
                <div class="snapshot-metrics">
                    <div class="metric-row">
                        <span>Territories:</span> <span>${snapshot.metrics.total_territories}</span>
                    </div>
                    <div class="metric-row">
                        <span>Characters:</span> <span>${snapshot.metrics.total_characters}</span>
                    </div>
                    <div class="metric-row">
                        <span>Events:</span> <span>${snapshot.metrics.total_events}</span>
                    </div>
                    <div class="metric-row">
                        <span>Conflicts:</span> <span>${snapshot.metrics.active_conflicts}</span>
                    </div>
                </div>
                <div class="snapshot-actions">
                    <button onclick="window.loadSnapshot('${snapshot.id}')" class="snapshot-load-btn">Load Snapshot</button>
                    <button onclick="window.compareSnapshot('${snapshot.id}')" class="snapshot-compare-btn">Compare</button>
                </div>
            </div>
        `, {
            maxWidth: 280,
            className: 'snapshot-popup-container'
        });

        // Add tooltip
        marker.bindTooltip(`${category.icon} ${snapshot.title}`, {
            direction: 'top',
            offset: [0, -10]
        });

        // Add click handler
        marker.on('click', () => {
            this.selectSnapshot(snapshot.id);
        });

        marker.addTo(this.snapshotLayer);
        this.snapshotMarkers.set(snapshot.id, marker);
    }

    cycleToX(cycle) {
        // Convert cycle to X coordinate for timeline positioning
        // This creates a linear timeline across the map
        const minCycle = -150;
        const maxCycle = 100;
        const minX = -180;
        const maxX = 180;

        const normalizedCycle = (cycle - minCycle) / (maxCycle - minCycle);
        return minX + (normalizedCycle * (maxX - minX));
    }

    async captureCurrentState(title, description, category = 'user_bookmark', tags = []) {
        if (this.isCapturing) {
            console.warn('Snapshot capture already in progress');
            return null;
        }

        this.isCapturing = true;

        try {
            // Get current time from temporal extension
            const currentTime = window.temporalExtension ?
                window.temporalExtension.getCurrentTime() :
                { cycle: 0, day: 1 };

            // Capture world state from all registered systems
            const worldState = await this.captureWorldState();

            // Calculate significance based on current state
            const significance = this.calculateSignificance(worldState);

            // Generate metrics
            const metrics = this.generateMetrics(worldState);

            // Create snapshot object
            const snapshot = {
                id: `snapshot_${Date.now()}`,
                timestamp: Date.now(),
                cycle: currentTime.cycle,
                day: currentTime.day,
                title: title,
                description: description,
                category: category,
                significance: significance,
                created_by: 'user',
                worldState: worldState,
                thumbnail: null,
                tags: tags,
                metrics: metrics
            };

            // Generate thumbnail
            snapshot.thumbnail = await this.generateThumbnail();

            // Store snapshot
            this.snapshots.set(snapshot.id, snapshot);
            this.createSnapshotMarker(snapshot);

            // Save to backend
            await this.saveSnapshot(snapshot);

            console.log(`Created snapshot: ${snapshot.title}`);
            return snapshot;

        } catch (error) {
            console.error('Failed to capture snapshot:', error);
            return null;
        } finally {
            this.isCapturing = false;
        }
    }

    async captureWorldState() {
        const worldState = {
            timestamp: Date.now(),
            mapBounds: this.map.getBounds(),
            mapZoom: this.map.getZoom(),
            mapCenter: this.map.getCenter()
        };

        // Capture state from each registered visualization system
        for (const [name, system] of this.visualizationSystems) {
            try {
                if (typeof system.getState === 'function') {
                    worldState[name] = await system.getState();
                } else if (typeof system.getCurrentState === 'function') {
                    worldState[name] = await system.getCurrentState();
                } else {
                    // Fallback: capture basic state information
                    worldState[name] = this.captureSystemBasicState(system);
                }
            } catch (error) {
                console.warn(`Failed to capture state from ${name}:`, error);
                worldState[name] = null;
            }
        }

        return worldState;
    }

    captureSystemBasicState(system) {
        // Basic state capture for systems without getState method
        const state = {};

        if (system.currentTime) state.currentTime = system.currentTime;
        if (system.options) state.options = { ...system.options };
        if (system.selectedCharacters) state.selectedCharacters = Array.from(system.selectedCharacters);
        if (system.getCurrentEpoch) state.currentEpoch = system.getCurrentEpoch();

        return state;
    }

    calculateSignificance(worldState) {
        let significance = 0.1; // Base significance

        // Increase significance based on various factors
        Object.entries(worldState).forEach(([systemName, state]) => {
            if (!state) return;

            switch (systemName) {
                case 'territorySystem':
                    if (state.activeConflicts > 0) significance += 0.2;
                    if (state.totalTerritories > 3) significance += 0.1;
                    break;
                case 'characterSystem':
                    if (state.selectedCharacters > 2) significance += 0.15;
                    break;
                case 'epochSystem':
                    if (state.currentEpoch && state.currentEpoch.name) significance += 0.1;
                    break;
            }
        });

        return Math.min(1.0, significance);
    }

    generateMetrics(worldState) {
        const metrics = {
            total_territories: 0,
            total_characters: 0,
            total_events: 0,
            active_conflicts: 0,
            selected_elements: 0
        };

        // Extract metrics from world state
        Object.entries(worldState).forEach(([systemName, state]) => {
            if (!state) return;

            if (state.totalTerritories) metrics.total_territories = state.totalTerritories;
            if (state.totalCharacters) metrics.total_characters = state.totalCharacters;
            if (state.totalEvents) metrics.total_events = state.totalEvents;
            if (state.activeConflicts) metrics.active_conflicts = state.activeConflicts;
            if (state.selectedCharacters) metrics.selected_elements += state.selectedCharacters.length || 0;
        });

        return metrics;
    }

    async generateThumbnail() {
        try {
            // Create a canvas element for thumbnail generation
            const canvas = document.createElement('canvas');
            canvas.width = this.options.previewSize.width;
            canvas.height = this.options.previewSize.height;
            const ctx = canvas.getContext('2d');

            // Fill with a background color
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Add some basic visual representation
            ctx.fillStyle = '#3498db';
            ctx.font = '12px Arial';
            ctx.fillText('Snapshot Preview', 10, 30);
            ctx.fillText(`${new Date().toLocaleDateString()}`, 10, 50);

            // Convert to data URL
            return canvas.toDataURL('image/png', this.options.compressionLevel);
        } catch (error) {
            console.warn('Failed to generate thumbnail:', error);
            return null;
        }
    }

    async saveSnapshot(snapshot) {
        try {
            const response = await fetch('/api/snapshots/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(snapshot)
            });

            if (!response.ok) {
                throw new Error(`Failed to save snapshot: ${response.status}`);
            }

            console.log(`Snapshot saved: ${snapshot.id}`);
        } catch (error) {
            console.warn('Could not save snapshot to backend:', error);
            // Store locally as fallback
            localStorage.setItem(`snapshot_${snapshot.id}`, JSON.stringify(snapshot));
        }
    }

    async loadSnapshot(snapshotId) {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            console.error(`Snapshot not found: ${snapshotId}`);
            return false;
        }

        if (this.isReplaying) {
            console.warn('Snapshot replay already in progress');
            return false;
        }

        this.isReplaying = true;

        try {
            console.log(`Loading snapshot: ${snapshot.title}`);

            // Restore world state to each visualization system
            await this.restoreWorldState(snapshot.worldState);

            // Update map view
            if (snapshot.worldState.mapBounds) {
                this.map.fitBounds(snapshot.worldState.mapBounds);
            }
            if (snapshot.worldState.mapZoom && snapshot.worldState.mapCenter) {
                this.map.setView(snapshot.worldState.mapCenter, snapshot.worldState.mapZoom);
            }

            // Update temporal controls if available
            if (window.temporalExtension) {
                window.temporalExtension.jumpToTime(snapshot.cycle, snapshot.day);
            }

            this.currentSnapshot = snapshot;
            this.highlightSnapshotMarker(snapshotId);

            return true;

        } catch (error) {
            console.error('Failed to load snapshot:', error);
            return false;
        } finally {
            this.isReplaying = false;
        }
    }

    async restoreWorldState(worldState) {
        // Restore state to each registered visualization system
        for (const [name, system] of this.visualizationSystems) {
            const systemState = worldState[name];
            if (!systemState) continue;

            try {
                if (typeof system.setState === 'function') {
                    await system.setState(systemState);
                } else if (typeof system.restoreState === 'function') {
                    await system.restoreState(systemState);
                } else {
                    // Fallback: restore basic state
                    this.restoreSystemBasicState(system, systemState);
                }
            } catch (error) {
                console.warn(`Failed to restore state to ${name}:`, error);
            }
        }
    }

    restoreSystemBasicState(system, state) {
        // Basic state restoration for systems without setState method
        if (state.currentTime && system.updateTimeDisplay) {
            system.updateTimeDisplay(state.currentTime.cycle, state.currentTime.day);
        }

        if (state.options) {
            Object.assign(system.options, state.options);
        }

        if (state.selectedCharacters && system.selectedCharacters) {
            system.selectedCharacters.clear();
            state.selectedCharacters.forEach(id => system.selectedCharacters.add(id));
        }
    }

    selectSnapshot(snapshotId) {
        // Clear previous selections
        this.snapshotMarkers.forEach((marker, id) => {
            marker.setStyle({
                weight: 2,
                opacity: 0.9
            });
        });

        // Highlight selected snapshot
        this.highlightSnapshotMarker(snapshotId);
        this.currentSnapshot = this.snapshots.get(snapshotId);
    }

    highlightSnapshotMarker(snapshotId) {
        const marker = this.snapshotMarkers.get(snapshotId);
        if (marker) {
            marker.setStyle({
                weight: 4,
                opacity: 1,
                color: '#f39c12'
            });
        }
    }

    deleteSnapshot(snapshotId) {
        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) return false;

        // Remove marker
        const marker = this.snapshotMarkers.get(snapshotId);
        if (marker) {
            this.snapshotLayer.removeLayer(marker);
            this.snapshotMarkers.delete(snapshotId);
        }

        // Remove from storage
        this.snapshots.delete(snapshotId);

        // Remove from backend
        this.deleteSnapshotFromBackend(snapshotId);

        console.log(`Deleted snapshot: ${snapshot.title}`);
        return true;
    }

    async deleteSnapshotFromBackend(snapshotId) {
        try {
            await fetch(`/api/snapshots/delete/${snapshotId}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.warn('Could not delete snapshot from backend:', error);
            // Remove from local storage
            localStorage.removeItem(`snapshot_${snapshotId}`);
        }
    }

    compareSnapshots(snapshotId1, snapshotId2) {
        const snapshot1 = this.snapshots.get(snapshotId1);
        const snapshot2 = this.snapshots.get(snapshotId2);

        if (!snapshot1 || !snapshot2) {
            console.error('One or both snapshots not found');
            return null;
        }

        const comparison = {
            timespan: {
                cycles: snapshot2.cycle - snapshot1.cycle,
                days: snapshot2.day - snapshot1.day
            },
            metrics: {},
            changes: []
        };

        // Compare metrics
        Object.keys(snapshot1.metrics).forEach(key => {
            const value1 = snapshot1.metrics[key] || 0;
            const value2 = snapshot2.metrics[key] || 0;
            const change = value2 - value1;
            const percentChange = value1 > 0 ? (change / value1) * 100 : 0;

            comparison.metrics[key] = {
                before: value1,
                after: value2,
                change: change,
                percentChange: percentChange
            };

            if (Math.abs(change) > 0) {
                comparison.changes.push({
                    metric: key,
                    description: `${key.replace('_', ' ')} ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change)}`,
                    significance: Math.abs(percentChange) / 100
                });
            }
        });

        return comparison;
    }

    setupAutoSnapshot() {
        if (!this.options.autoSnapshot) return;

        // Monitor for significant changes and automatically create snapshots
        setInterval(() => {
            this.checkForAutoSnapshot();
        }, 30000); // Check every 30 seconds
    }

    async checkForAutoSnapshot() {
        try {
            const currentTime = window.temporalExtension ?
                window.temporalExtension.getCurrentTime() :
                { cycle: 0, day: 1 };

            // Check if enough time has passed since last snapshot
            const lastSnapshot = Array.from(this.snapshots.values())
                .sort((a, b) => b.timestamp - a.timestamp)[0];

            if (lastSnapshot) {
                const cyclesSinceLastSnapshot = Math.abs(currentTime.cycle - lastSnapshot.cycle);
                if (cyclesSinceLastSnapshot < this.options.snapshotInterval) {
                    return; // Not enough time passed
                }
            }

            // Capture current state and check significance
            const worldState = await this.captureWorldState();
            const significance = this.calculateSignificance(worldState);

            if (significance >= this.options.significanceThreshold) {
                // Auto-create snapshot
                await this.captureCurrentState(
                    `Auto Snapshot - Cycle ${currentTime.cycle}`,
                    'Automatically generated snapshot due to significant world changes',
                    'milestone',
                    ['auto-generated', 'significant-change']
                );
            }
        } catch (error) {
            console.warn('Auto snapshot check failed:', error);
        }
    }

    updateSnapshotTimeline() {
        // Update any timeline visualizations
        // This could integrate with the temporal controls
    }

    // Public API methods
    enableSnapshots() {
        this.snapshotLayer.addTo(this.map);
        this.options.enableSnapshots = true;
    }

    disableSnapshots() {
        this.map.removeLayer(this.snapshotLayer);
        this.options.enableSnapshots = false;
    }

    getSnapshotList() {
        return Array.from(this.snapshots.values()).sort((a, b) => a.cycle - b.cycle);
    }

    getSnapshotsByCategory(category) {
        return Array.from(this.snapshots.values()).filter(s => s.category === category);
    }

    getSnapshotsByTimeRange(startCycle, endCycle) {
        return Array.from(this.snapshots.values()).filter(s =>
            s.cycle >= startCycle && s.cycle <= endCycle
        );
    }

    exportSnapshots() {
        const exportData = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            snapshots: Array.from(this.snapshots.values())
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historical_snapshots_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importSnapshots(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (data.snapshots && Array.isArray(data.snapshots)) {
                data.snapshots.forEach(snapshot => {
                    // Ensure unique IDs
                    snapshot.id = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    this.snapshots.set(snapshot.id, snapshot);
                    this.createSnapshotMarker(snapshot);
                });

                console.log(`Imported ${data.snapshots.length} snapshots`);
                return true;
            }
        } catch (error) {
            console.error('Failed to import snapshots:', error);
            return false;
        }
    }

    getStats() {
        const snapshots = Array.from(this.snapshots.values());
        const categories = {};

        snapshots.forEach(snapshot => {
            categories[snapshot.category] = (categories[snapshot.category] || 0) + 1;
        });

        return {
            totalSnapshots: snapshots.length,
            categoryCounts: categories,
            timeRange: {
                earliest: Math.min(...snapshots.map(s => s.cycle)),
                latest: Math.max(...snapshots.map(s => s.cycle))
            },
            averageSignificance: snapshots.reduce((sum, s) => sum + s.significance, 0) / snapshots.length,
            currentSnapshot: this.currentSnapshot?.id || null,
            isCapturing: this.isCapturing,
            isReplaying: this.isReplaying
        };
    }

    destroy() {
        if (this.snapshotLayer) {
            this.map.removeLayer(this.snapshotLayer);
        }

        this.snapshots.clear();
        this.snapshotMarkers.clear();
        this.visualizationSystems.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoricalSnapshotSystem;
}