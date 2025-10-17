/**
 * Temporal Timeline Viewer
 * Zoomable timeline component for visualizing historical events
 *
 * Features:
 * - Horizontal scrollable timeline
 * - 7 zoom levels: Epoch (10,000 cycles) → Day (1 day)
 * - Event markers with clustering
 * - Drag to navigate, scroll to zoom
 * - Filter by event type, importance, location
 */

class TemporalTimeline {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container ${containerId} not found`);
        }

        // Configuration
        this.options = {
            width: options.width || this.container.clientWidth,
            height: options.height || 200,
            initialCycle: options.initialCycle || 0,
            initialZoomLevel: options.initialZoomLevel || 3, // Start at 'cycle' view
            onEventClick: options.onEventClick || null,
            onTimeChange: options.onTimeChange || null,
            ...options
        };

        // Zoom levels (cycles visible in viewport)
        this.zoomLevels = [
            { name: 'epoch', span: 10000, tickInterval: 1000, label: 'Epoch' },      // 0
            { name: 'millennium', span: 1000, tickInterval: 100, label: 'Millennium' }, // 1
            { name: 'century', span: 100, tickInterval: 10, label: 'Century' },      // 2
            { name: 'decade', span: 10, tickInterval: 1, label: 'Decade' },          // 3
            { name: 'cycle', span: 1, tickInterval: 0.25, label: 'Cycle' },          // 4 (seasons)
            { name: 'month', span: 0.0833, tickInterval: 0.0083, label: 'Month' },   // 5 (1/12 cycle)
            { name: 'day', span: 0.00278, tickInterval: 0.00278, label: 'Day' }      // 6 (1/360 cycle)
        ];

        this.currentZoomLevel = this.options.initialZoomLevel;
        this.currentCycle = this.options.initialCycle; // Center of viewport
        this.events = [];
        this.eras = [];
        this.filters = {
            eventTypes: [],
            minImportance: 0,
            locationType: null,
            locationId: null
        };

        // State
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartCycle = 0;

        this.init();
    }

    async init() {
        this.createDOM();
        this.setupEventListeners();
        await this.loadEras();
        await this.loadEvents();
        this.render();
    }

    createDOM() {
        this.container.innerHTML = `
            <div class="temporal-timeline">
                <div class="timeline-controls">
                    <div class="zoom-controls">
                        <button id="zoomOut" title="Zoom Out">-</button>
                        <span id="zoomLevel">${this.zoomLevels[this.currentZoomLevel].label}</span>
                        <button id="zoomIn" title="Zoom In">+</button>
                    </div>
                    <div class="time-display">
                        <span id="currentTime">Cycle ${this.currentCycle}</span>
                    </div>
                    <div class="timeline-filters">
                        <select id="eventTypeFilter" multiple>
                            <option value="">All Event Types</option>
                            <option value="battle">Battles</option>
                            <option value="founding">Foundings</option>
                            <option value="treaty">Treaties</option>
                            <option value="birth">Births</option>
                            <option value="death">Deaths</option>
                            <option value="discovery">Discoveries</option>
                        </select>
                        <label>
                            Min Importance: <input type="range" id="importanceFilter" min="0" max="10" value="0">
                            <span id="importanceValue">0</span>
                        </label>
                    </div>
                </div>
                <div class="timeline-canvas-container">
                    <canvas id="timelineCanvas" width="${this.options.width}" height="${this.options.height}"></canvas>
                    <div id="eventTooltip" class="event-tooltip"></div>
                </div>
                <div class="timeline-minimap">
                    <canvas id="minimapCanvas" width="${this.options.width}" height="40"></canvas>
                </div>
            </div>
        `;

        this.canvas = this.container.querySelector('#timelineCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimap = this.container.querySelector('#minimapCanvas');
        this.minimapCtx = this.minimap.getContext('2d');
        this.tooltip = this.container.querySelector('#eventTooltip');
    }

    setupEventListeners() {
        // Zoom controls
        this.container.querySelector('#zoomIn').addEventListener('click', () => this.zoomIn());
        this.container.querySelector('#zoomOut').addEventListener('click', () => this.zoomOut());

        // Canvas drag
        this.canvas.addEventListener('mousedown', (e) => this.onDragStart(e));
        this.canvas.addEventListener('mousemove', (e) => this.onDrag(e));
        this.canvas.addEventListener('mouseup', () => this.onDragEnd());
        this.canvas.addEventListener('mouseleave', () => this.onDragEnd());

        // Canvas click for event selection
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));

        // Mouse wheel zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        });

        // Filters
        const typeFilter = this.container.querySelector('#eventTypeFilter');
        typeFilter.addEventListener('change', () => {
            this.filters.eventTypes = Array.from(typeFilter.selectedOptions).map(opt => opt.value).filter(v => v);
            this.render();
        });

        const importanceFilter = this.container.querySelector('#importanceFilter');
        importanceFilter.addEventListener('input', () => {
            this.filters.minImportance = parseInt(importanceFilter.value);
            this.container.querySelector('#importanceValue').textContent = importanceFilter.value;
            this.render();
        });

        // Tooltip
        this.canvas.addEventListener('mousemove', (e) => this.showTooltip(e));
    }

    async loadEras() {
        try {
            const response = await fetch('/api/temporal/timeline-metadata');
            const data = await response.json();
            if (data.success) {
                this.eras = data.eras;
            }
        } catch (error) {
            console.error('Error loading eras:', error);
        }
    }

    async loadEvents() {
        try {
            const zoom = this.zoomLevels[this.currentZoomLevel];
            const cycleStart = Math.floor(this.currentCycle - zoom.span);
            const cycleEnd = Math.ceil(this.currentCycle + zoom.span);

            let url = `/api/temporal/events?cycle_start=${cycleStart}&cycle_end=${cycleEnd}`;

            // Apply filters
            if (this.filters.eventTypes.length > 0) {
                // Load events for each type and combine
                const promises = this.filters.eventTypes.map(type =>
                    fetch(`/api/temporal/events/type/${type}?cycle_start=${cycleStart}&cycle_end=${cycleEnd}`).then(r => r.json())
                );
                const results = await Promise.all(promises);
                this.events = results.flatMap(r => r.success ? r.events : []);
            } else {
                const response = await fetch(url);
                const data = await response.json();
                if (data.success) {
                    this.events = data.events;
                }
            }

            // Filter by importance
            if (this.filters.minImportance > 0) {
                this.events = this.events.filter(e => e.importance >= this.filters.minImportance);
            }

            // Filter by location if set
            if (this.filters.locationType && this.filters.locationId) {
                this.events = this.events.filter(e =>
                    e.location_type === this.filters.locationType &&
                    e.location_id === this.filters.locationId
                );
            }

        } catch (error) {
            console.error('Error loading events:', error);
        }
    }

    render() {
        this.clearCanvas();
        this.drawEras();
        this.drawTimeline();
        this.drawEvents();
        this.drawViewportIndicator();
        this.updateMinimap();
        this.updateTimeDisplay();
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawEras() {
        const zoom = this.zoomLevels[this.currentZoomLevel];
        const cyclesPerPixel = (zoom.span * 2) / this.canvas.width;

        this.eras.forEach(era => {
            const startX = this.cycleToX(era.cycle_start);
            const endX = this.cycleToX(era.cycle_end);

            if (endX < 0 || startX > this.canvas.width) return; // Outside viewport

            // Draw era background
            this.ctx.fillStyle = era.color + '20'; // 20 = 12.5% opacity
            this.ctx.fillRect(
                Math.max(0, startX),
                0,
                Math.min(this.canvas.width, endX) - Math.max(0, startX),
                this.canvas.height
            );

            // Draw era label if wide enough
            const width = endX - startX;
            if (width > 100) {
                this.ctx.fillStyle = era.color;
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(era.epoch_name, (startX + endX) / 2, 20);
            }
        });
    }

    drawTimeline() {
        const zoom = this.zoomLevels[this.currentZoomLevel];
        const centerY = this.canvas.height / 2;

        // Draw main timeline axis
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width, centerY);
        this.ctx.stroke();

        // Draw tick marks
        const tickInterval = zoom.tickInterval;
        const startCycle = Math.floor((this.currentCycle - zoom.span) / tickInterval) * tickInterval;
        const endCycle = Math.ceil((this.currentCycle + zoom.span) / tickInterval) * tickInterval;

        for (let cycle = startCycle; cycle <= endCycle; cycle += tickInterval) {
            const x = this.cycleToX(cycle);
            if (x < 0 || x > this.canvas.width) continue;

            // Major ticks every 5 intervals
            const isMajor = cycle % (tickInterval * 5) === 0;
            const tickHeight = isMajor ? 20 : 10;

            this.ctx.strokeStyle = isMajor ? '#333' : '#999';
            this.ctx.lineWidth = isMajor ? 2 : 1;
            this.ctx.beginPath();
            this.ctx.moveTo(x, centerY - tickHeight / 2);
            this.ctx.lineTo(x, centerY + tickHeight / 2);
            this.ctx.stroke();

            // Draw label for major ticks
            if (isMajor) {
                this.ctx.fillStyle = '#333';
                this.ctx.font = '11px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(Math.round(cycle), x, centerY + 35);
            }
        }
    }

    drawEvents() {
        const centerY = this.canvas.height / 2;
        const zoom = this.zoomLevels[this.currentZoomLevel];

        // Group nearby events for clustering at low zoom levels
        const clusters = this.clusterEvents();

        clusters.forEach(cluster => {
            const x = this.cycleToX(cluster.cycle);
            if (x < 0 || x > this.canvas.width) return;

            // Event marker
            const radius = cluster.count > 1 ? 8 : 5;
            const color = this.getEventColor(cluster.events[0]);

            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(x, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Outline
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Cluster count
            if (cluster.count > 1) {
                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(cluster.count, x, centerY);
            }

            // Importance indicator (vertical line)
            if (cluster.events[0].importance >= 7) {
                const lineHeight = 20 + (cluster.events[0].importance * 2);
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(x, centerY - radius);
                this.ctx.lineTo(x, centerY - lineHeight);
                this.ctx.stroke();
            }
        });
    }

    clusterEvents() {
        const zoom = this.zoomLevels[this.currentZoomLevel];
        const clusterThreshold = zoom.span / 100; // Cluster within 1% of view

        const clusters = [];
        const processed = new Set();

        this.events.forEach((event, i) => {
            if (processed.has(i)) return;

            const cycle = event.cycle_start + (event.day_start || 0) / 360;
            const nearbyEvents = [event];
            processed.add(i);

            // Find nearby events
            this.events.forEach((other, j) => {
                if (i === j || processed.has(j)) return;
                const otherCycle = other.cycle_start + (other.day_start || 0) / 360;
                if (Math.abs(cycle - otherCycle) < clusterThreshold) {
                    nearbyEvents.push(other);
                    processed.add(j);
                }
            });

            clusters.push({
                cycle: cycle,
                count: nearbyEvents.length,
                events: nearbyEvents
            });
        });

        return clusters;
    }

    getEventColor(event) {
        const colors = {
            battle: '#e74c3c',
            founding: '#3498db',
            treaty: '#2ecc71',
            birth: '#f39c12',
            death: '#95a5a6',
            discovery: '#9b59b6',
            default: '#34495e'
        };
        return colors[event.event_type] || colors.default;
    }

    drawViewportIndicator() {
        // Draw current time indicator (center line)
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    updateMinimap() {
        this.minimapCtx.clearRect(0, 0, this.minimap.width, this.minimap.height);

        // Draw full timeline range
        const totalRange = 12000; // -10000 to +2000
        const offsetCycle = 10000; // Offset to make all positive for drawing

        // Draw eras on minimap
        this.eras.forEach(era => {
            const startX = ((era.cycle_start + offsetCycle) / totalRange) * this.minimap.width;
            const endX = ((era.cycle_end + offsetCycle) / totalRange) * this.minimap.width;

            this.minimapCtx.fillStyle = era.color + '40';
            this.minimapCtx.fillRect(startX, 0, endX - startX, this.minimap.height);
        });

        // Draw viewport indicator
        const zoom = this.zoomLevels[this.currentZoomLevel];
        const viewStart = ((this.currentCycle - zoom.span + offsetCycle) / totalRange) * this.minimap.width;
        const viewEnd = ((this.currentCycle + zoom.span + offsetCycle) / totalRange) * this.minimap.width;

        this.minimapCtx.strokeStyle = '#e74c3c';
        this.minimapCtx.lineWidth = 2;
        this.minimapCtx.strokeRect(viewStart, 0, viewEnd - viewStart, this.minimap.height);
    }

    updateTimeDisplay() {
        const timeDisplay = this.container.querySelector('#currentTime');
        const zoom = this.zoomLevels[this.currentZoomLevel];

        // Load time converter if available
        if (typeof timeConverter !== 'undefined') {
            const day = Math.round((this.currentCycle % 1) * 360) || 1;
            const cycle = Math.floor(this.currentCycle);
            timeDisplay.textContent = timeConverter.cycleToReadable(cycle, day);
        } else {
            timeDisplay.textContent = `Cycle ${Math.round(this.currentCycle * 100) / 100}`;
        }

        // Update zoom level display
        const zoomLabel = this.container.querySelector('#zoomLevel');
        zoomLabel.textContent = zoom.label;
    }

    cycleToX(cycle) {
        const zoom = this.zoomLevels[this.currentZoomLevel];
        const cyclesPerPixel = (zoom.span * 2) / this.canvas.width;
        return (cycle - (this.currentCycle - zoom.span)) / cyclesPerPixel;
    }

    xToCycle(x) {
        const zoom = this.zoomLevels[this.currentZoomLevel];
        const cyclesPerPixel = (zoom.span * 2) / this.canvas.width;
        return (this.currentCycle - zoom.span) + (x * cyclesPerPixel);
    }

    zoomIn() {
        if (this.currentZoomLevel < this.zoomLevels.length - 1) {
            this.currentZoomLevel++;
            this.loadEvents().then(() => this.render());
        }
    }

    zoomOut() {
        if (this.currentZoomLevel > 0) {
            this.currentZoomLevel--;
            this.loadEvents().then(() => this.render());
        }
    }

    onDragStart(e) {
        this.isDragging = true;
        this.dragStartX = e.offsetX;
        this.dragStartCycle = this.currentCycle;
        this.canvas.style.cursor = 'grabbing';
    }

    onDrag(e) {
        if (!this.isDragging) return;

        const dx = e.offsetX - this.dragStartX;
        const zoom = this.zoomLevels[this.currentZoomLevel];
        const cyclesPerPixel = (zoom.span * 2) / this.canvas.width;

        this.currentCycle = this.dragStartCycle - (dx * cyclesPerPixel);
        this.render();
    }

    onDragEnd() {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
            this.loadEvents().then(() => this.render());

            if (this.options.onTimeChange) {
                this.options.onTimeChange(this.currentCycle);
            }
        }
    }

    onCanvasClick(e) {
        const x = e.offsetX;
        const y = e.offsetY;
        const centerY = this.canvas.height / 2;

        // Find clicked event
        const clusters = this.clusterEvents();
        for (const cluster of clusters) {
            const eventX = this.cycleToX(cluster.cycle);
            const radius = cluster.count > 1 ? 8 : 5;

            const distance = Math.sqrt(Math.pow(x - eventX, 2) + Math.pow(y - centerY, 2));
            if (distance <= radius) {
                if (cluster.count === 1 && this.options.onEventClick) {
                    this.options.onEventClick(cluster.events[0]);
                } else {
                    // Show cluster details
                    this.showClusterDetails(cluster, eventX, centerY);
                }
                return;
            }
        }
    }

    showTooltip(e) {
        const x = e.offsetX;
        const y = e.offsetY;
        const centerY = this.canvas.height / 2;

        const clusters = this.clusterEvents();
        for (const cluster of clusters) {
            const eventX = this.cycleToX(cluster.cycle);
            const radius = cluster.count > 1 ? 8 : 5;

            const distance = Math.sqrt(Math.pow(x - eventX, 2) + Math.pow(y - centerY, 2));
            if (distance <= radius) {
                const event = cluster.events[0];
                this.tooltip.innerHTML = `
                    <strong>${event.title}</strong><br>
                    ${event.formatted_time}<br>
                    ${cluster.count > 1 ? `${cluster.count} events` : event.event_type}
                `;
                this.tooltip.style.left = `${e.pageX + 10}px`;
                this.tooltip.style.top = `${e.pageY + 10}px`;
                this.tooltip.style.display = 'block';
                return;
            }
        }

        this.tooltip.style.display = 'none';
    }

    showClusterDetails(cluster, x, y) {
        // Create a popup showing all events in cluster
        const popup = document.createElement('div');
        popup.className = 'cluster-popup';
        popup.innerHTML = `
            <h4>${cluster.count} Events</h4>
            ${cluster.events.map(e => `
                <div class="cluster-event" data-event-id="${e.id}">
                    <strong>${e.title}</strong><br>
                    <small>${e.formatted_time}</small>
                </div>
            `).join('')}
        `;

        popup.style.position = 'absolute';
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;
        this.container.appendChild(popup);

        // Add click handlers
        popup.querySelectorAll('.cluster-event').forEach(div => {
            div.addEventListener('click', () => {
                const eventId = div.getAttribute('data-event-id');
                const event = cluster.events.find(e => e.id == eventId);
                if (event && this.options.onEventClick) {
                    this.options.onEventClick(event);
                }
                popup.remove();
            });
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closePopup(e) {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', closePopup);
                }
            });
        }, 0);
    }

    // Public API
    setFilters(filters) {
        Object.assign(this.filters, filters);
        this.loadEvents().then(() => this.render());
    }

    jumpToCycle(cycle) {
        this.currentCycle = cycle;
        this.loadEvents().then(() => this.render());
    }

    jumpToEvent(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            this.currentCycle = event.cycle_start + (event.day_start || 0) / 360;
            this.render();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemporalTimeline;
}