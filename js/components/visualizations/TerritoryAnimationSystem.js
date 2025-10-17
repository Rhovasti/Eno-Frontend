/**
 * Territory Change Animation System
 * Creates dynamic visualizations of territorial boundaries, political changes, and border evolution over time
 *
 * Features:
 * - Animated territory expansion and contraction
 * - Dynamic border changes with smooth transitions
 * - Political control visualization with faction colors
 * - Territorial conflict zones and disputed areas
 * - Settlement growth and city state evolution
 * - Trade route territory influence
 * - Seasonal/temporal territory variations
 */

class TerritoryAnimationSystem {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            enableTerritories: options.enableTerritories !== false,
            animationSpeed: options.animationSpeed || 1,
            showBorders: options.showBorders !== false,
            showControlZones: options.showControlZones !== false,
            showConflictZones: options.showConflictZones !== false,
            showTradeRoutes: options.showTradeRoutes || false,
            borderWidth: options.borderWidth || 2,
            territoryOpacity: options.territoryOpacity || 0.3,
            animationDuration: options.animationDuration || 2000,
            smoothTransitions: options.smoothTransitions !== false,
            ...options
        };

        this.territories = new Map();
        this.borders = new Map();
        this.conflicts = new Map();
        this.tradeRoutes = new Map();
        this.settlements = new Map();

        this.territoryLayer = null;
        this.borderLayer = null;
        this.conflictLayer = null;
        this.tradeLayer = null;
        this.settlementLayer = null;

        this.currentTime = { cycle: 0, day: 1 };
        this.animationTimer = null;
        this.isAnimating = false;

        // Political factions and their colors
        this.factions = {
            'northern_kingdom': {
                name: 'Northern Kingdom',
                color: '#3498db',
                borderColor: '#2980b9',
                pattern: 'solid'
            },
            'southern_empire': {
                name: 'Southern Empire',
                color: '#e74c3c',
                borderColor: '#c0392b',
                pattern: 'solid'
            },
            'eastern_federation': {
                name: 'Eastern Federation',
                color: '#2ecc71',
                borderColor: '#27ae60',
                pattern: 'solid'
            },
            'western_clans': {
                name: 'Western Clans',
                color: '#f39c12',
                borderColor: '#d68910',
                pattern: 'dashed'
            },
            'central_city_states': {
                name: 'Central City-States',
                color: '#9b59b6',
                borderColor: '#8e44ad',
                pattern: 'dotted'
            },
            'nomadic_tribes': {
                name: 'Nomadic Tribes',
                color: '#1abc9c',
                borderColor: '#16a085',
                pattern: 'dashed'
            },
            'independent': {
                name: 'Independent Territories',
                color: '#95a5a6',
                borderColor: '#7f8c8d',
                pattern: 'dotted'
            },
            'disputed': {
                name: 'Disputed Territory',
                color: '#e67e22',
                borderColor: '#d35400',
                pattern: 'conflicted'
            }
        };

        this.init();
    }

    init() {
        this.createLayers();
        this.loadTerritorialData();

        if (this.options.enableTerritories) {
            this.enableTerritories();
        }
    }

    createLayers() {
        // Create layers in proper stacking order
        this.territoryLayer = L.layerGroup().addTo(this.map);
        this.borderLayer = L.layerGroup().addTo(this.map);
        this.conflictLayer = L.layerGroup().addTo(this.map);
        this.tradeLayer = L.layerGroup().addTo(this.map);
        this.settlementLayer = L.layerGroup().addTo(this.map);
    }

    async loadTerritorialData() {
        try {
            // Try to load real territorial data from backend
            const response = await fetch('/api/territories/timeline');
            if (!response.ok) {
                throw new Error(`Failed to load territorial data: ${response.status}`);
            }

            const data = await response.json();
            this.processTerritorialData(data);
        } catch (error) {
            console.warn('Could not load territorial data, using sample data:', error);
            this.loadSampleTerritorialData();
        }
    }

    loadSampleTerritorialData() {
        // Sample territorial evolution data
        const sampleTerritories = [
            {
                id: 'northern_kingdom_core',
                faction: 'northern_kingdom',
                type: 'kingdom',
                timeline: [
                    {
                        cycle: -100,
                        boundaries: [
                            [55, -130], [65, -120], [60, -100], [50, -110], [55, -130]
                        ],
                        capital: [58, -115],
                        population: 50000,
                        status: 'founding'
                    },
                    {
                        cycle: -50,
                        boundaries: [
                            [50, -140], [70, -110], [65, -90], [45, -105], [50, -140]
                        ],
                        capital: [58, -115],
                        population: 120000,
                        status: 'expansion'
                    },
                    {
                        cycle: 0,
                        boundaries: [
                            [45, -150], [75, -105], [70, -80], [40, -100], [45, -150]
                        ],
                        capital: [58, -115],
                        population: 200000,
                        status: 'peak'
                    },
                    {
                        cycle: 50,
                        boundaries: [
                            [50, -145], [70, -110], [65, -85], [45, -105], [50, -145]
                        ],
                        capital: [58, -115],
                        population: 180000,
                        status: 'decline'
                    }
                ]
            },
            {
                id: 'southern_empire_expansion',
                faction: 'southern_empire',
                type: 'empire',
                timeline: [
                    {
                        cycle: -80,
                        boundaries: [
                            [20, -110], [30, -100], [25, -80], [15, -90], [20, -110]
                        ],
                        capital: [22, -95],
                        population: 80000,
                        status: 'founding'
                    },
                    {
                        cycle: -40,
                        boundaries: [
                            [10, -120], [40, -90], [35, -70], [5, -85], [10, -120]
                        ],
                        capital: [22, -95],
                        population: 250000,
                        status: 'rapid_expansion'
                    },
                    {
                        cycle: -10,
                        boundaries: [
                            [5, -130], [45, -85], [40, -60], [0, -80], [5, -130]
                        ],
                        capital: [22, -95],
                        population: 400000,
                        status: 'imperial_peak'
                    },
                    {
                        cycle: 20,
                        boundaries: [
                            [15, -125], [40, -90], [35, -70], [10, -85], [15, -125]
                        ],
                        capital: [22, -95],
                        population: 320000,
                        status: 'contraction'
                    }
                ]
            },
            {
                id: 'eastern_federation_growth',
                faction: 'eastern_federation',
                type: 'federation',
                timeline: [
                    {
                        cycle: -60,
                        boundaries: [
                            [30, -70], [40, -60], [35, -40], [25, -50], [30, -70]
                        ],
                        capital: [32, -55],
                        population: 60000,
                        status: 'confederation'
                    },
                    {
                        cycle: -20,
                        boundaries: [
                            [25, -80], [50, -50], [45, -30], [20, -45], [25, -80]
                        ],
                        capital: [32, -55],
                        population: 150000,
                        status: 'federation'
                    },
                    {
                        cycle: 10,
                        boundaries: [
                            [30, -85], [55, -45], [50, -25], [25, -40], [30, -85]
                        ],
                        capital: [42, -55],
                        population: 180000,
                        status: 'mature_federation'
                    }
                ]
            },
            {
                id: 'western_clans_territory',
                faction: 'western_clans',
                type: 'tribal',
                timeline: [
                    {
                        cycle: -70,
                        boundaries: [
                            [40, -180], [50, -160], [45, -140], [35, -155], [40, -180]
                        ],
                        capital: null, // Nomadic
                        population: 30000,
                        status: 'tribal_lands'
                    },
                    {
                        cycle: -30,
                        boundaries: [
                            [35, -190], [55, -150], [50, -130], [30, -145], [35, -190]
                        ],
                        capital: [42, -165],
                        population: 45000,
                        status: 'unified_clans'
                    },
                    {
                        cycle: 0,
                        boundaries: [
                            [30, -185], [50, -145], [45, -125], [25, -140], [30, -185]
                        ],
                        capital: [42, -165],
                        population: 55000,
                        status: 'clan_confederation'
                    }
                ]
            },
            {
                id: 'central_city_states',
                faction: 'central_city_states',
                type: 'city_state',
                timeline: [
                    {
                        cycle: -50,
                        boundaries: [
                            [35, -120], [45, -110], [40, -90], [30, -100], [35, -120]
                        ],
                        capital: [37, -105],
                        population: 40000,
                        status: 'independent_cities'
                    },
                    {
                        cycle: -10,
                        boundaries: [
                            [32, -125], [48, -105], [43, -85], [27, -95], [32, -125]
                        ],
                        capital: [37, -105],
                        population: 65000,
                        status: 'city_league'
                    },
                    {
                        cycle: 30,
                        boundaries: [
                            [35, -122], [45, -108], [40, -88], [30, -98], [35, -122]
                        ],
                        capital: [37, -105],
                        population: 58000,
                        status: 'declining_league'
                    }
                ]
            }
        ];

        // Sample conflict zones
        const sampleConflicts = [
            {
                id: 'northern_southern_border',
                participants: ['northern_kingdom', 'southern_empire'],
                timeline: [
                    {
                        cycle: -30,
                        zone: [
                            [40, -120], [50, -110], [45, -90], [35, -100], [40, -120]
                        ],
                        intensity: 0.3,
                        status: 'border_skirmishes'
                    },
                    {
                        cycle: -10,
                        zone: [
                            [42, -118], [48, -108], [43, -92], [37, -102], [42, -118]
                        ],
                        intensity: 0.8,
                        status: 'active_conflict'
                    },
                    {
                        cycle: 10,
                        zone: [
                            [44, -115], [46, -105], [41, -95], [39, -105], [44, -115]
                        ],
                        intensity: 0.2,
                        status: 'ceasefire'
                    }
                ]
            },
            {
                id: 'eastern_central_dispute',
                participants: ['eastern_federation', 'central_city_states'],
                timeline: [
                    {
                        cycle: -20,
                        zone: [
                            [35, -85], [40, -80], [38, -70], [33, -75], [35, -85]
                        ],
                        intensity: 0.5,
                        status: 'territorial_dispute'
                    },
                    {
                        cycle: 0,
                        zone: [
                            [36, -83], [39, -78], [37, -72], [34, -77], [36, -83]
                        ],
                        intensity: 0.3,
                        status: 'negotiated_settlement'
                    }
                ]
            }
        ];

        // Sample trade routes
        const sampleTradeRoutes = [
            {
                id: 'great_northern_route',
                name: 'Great Northern Trade Route',
                timeline: [
                    {
                        cycle: -40,
                        path: [
                            [58, -115], [45, -105], [37, -105], [32, -55], [42, -55]
                        ],
                        volume: 1000,
                        status: 'established'
                    },
                    {
                        cycle: 0,
                        path: [
                            [58, -115], [45, -105], [37, -105], [32, -55], [42, -55], [50, -45]
                        ],
                        volume: 2500,
                        status: 'flourishing'
                    },
                    {
                        cycle: 30,
                        path: [
                            [58, -115], [45, -105], [37, -105], [32, -55]
                        ],
                        volume: 1200,
                        status: 'declining'
                    }
                ]
            }
        ];

        this.processTerritorialData({
            territories: sampleTerritories,
            conflicts: sampleConflicts,
            tradeRoutes: sampleTradeRoutes
        });
    }

    processTerritorialData(data) {
        // Process territories
        data.territories.forEach(territory => {
            this.territories.set(territory.id, territory);
        });

        // Process conflicts
        if (data.conflicts) {
            data.conflicts.forEach(conflict => {
                this.conflicts.set(conflict.id, conflict);
            });
        }

        // Process trade routes
        if (data.tradeRoutes) {
            data.tradeRoutes.forEach(route => {
                this.tradeRoutes.set(route.id, route);
            });
        }

        console.log(`Loaded ${data.territories.length} territories, ${data.conflicts?.length || 0} conflicts, ${data.tradeRoutes?.length || 0} trade routes`);

        // Initial render
        this.updateTerritorialDisplay(this.currentTime.cycle);
    }

    updateTerritorialDisplay(cycle, animate = true) {
        this.currentTime.cycle = cycle;

        if (animate && this.options.smoothTransitions) {
            this.animateTerritorialChanges(cycle);
        } else {
            this.renderTerritorialState(cycle);
        }
    }

    renderTerritorialState(cycle) {
        // Clear existing layers
        this.clearLayers();

        // Render territories
        if (this.options.enableTerritories) {
            this.renderTerritories(cycle);
        }

        // Render borders
        if (this.options.showBorders) {
            this.renderBorders(cycle);
        }

        // Render conflict zones
        if (this.options.showConflictZones) {
            this.renderConflictZones(cycle);
        }

        // Render trade routes
        if (this.options.showTradeRoutes) {
            this.renderTradeRoutes(cycle);
        }

        // Render settlements
        this.renderSettlements(cycle);
    }

    renderTerritories(cycle) {
        this.territories.forEach((territory, territoryId) => {
            const stateAtTime = this.getTerritorialStateAtTime(territory, cycle);
            if (!stateAtTime || !stateAtTime.boundaries) return;

            const faction = this.factions[territory.faction];
            if (!faction) return;

            // Create territory polygon
            const territoryPolygon = L.polygon(stateAtTime.boundaries, {
                fillColor: faction.color,
                fillOpacity: this.options.territoryOpacity,
                color: faction.borderColor,
                weight: this.options.borderWidth,
                opacity: 0.8,
                interactive: true,
                className: `territory-${territory.faction}`
            });

            // Add popup with territory information
            territoryPolygon.bindPopup(`
                <div class="territory-popup">
                    <h4>${faction.name}</h4>
                    <div class="territory-info">
                        <p><strong>Type:</strong> ${territory.type}</p>
                        <p><strong>Population:</strong> ${stateAtTime.population.toLocaleString()}</p>
                        <p><strong>Status:</strong> ${stateAtTime.status.replace('_', ' ')}</p>
                        <p><strong>Time:</strong> Cycle ${cycle}</p>
                    </div>
                </div>
            `);

            // Add tooltip
            territoryPolygon.bindTooltip(`${faction.name} - ${stateAtTime.population.toLocaleString()}`, {
                sticky: true,
                className: 'territory-tooltip'
            });

            territoryPolygon.addTo(this.territoryLayer);

            // Add capital marker if exists
            if (stateAtTime.capital) {
                const capitalMarker = L.circleMarker(stateAtTime.capital, {
                    radius: 8,
                    fillColor: faction.borderColor,
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8,
                    interactive: true
                });

                capitalMarker.bindPopup(`
                    <div class="capital-popup">
                        <h4>Capital of ${faction.name}</h4>
                        <p>Population: ${Math.floor(stateAtTime.population * 0.2).toLocaleString()}</p>
                        <p>Cycle: ${cycle}</p>
                    </div>
                `);

                capitalMarker.addTo(this.settlementLayer);
            }
        });
    }

    renderBorders(cycle) {
        // Enhanced border rendering with different styles for different types
        this.territories.forEach((territory, territoryId) => {
            const stateAtTime = this.getTerritorialStateAtTime(territory, cycle);
            if (!stateAtTime || !stateAtTime.boundaries) return;

            const faction = this.factions[territory.faction];
            if (!faction) return;

            const borderOptions = {
                color: faction.borderColor,
                weight: this.options.borderWidth + 1,
                opacity: 0.9,
                interactive: false
            };

            // Apply pattern based on faction type
            switch (faction.pattern) {
                case 'dashed':
                    borderOptions.dashArray = '10, 10';
                    break;
                case 'dotted':
                    borderOptions.dashArray = '5, 15';
                    break;
                case 'conflicted':
                    borderOptions.dashArray = '15, 5, 5, 5';
                    borderOptions.color = '#e67e22';
                    break;
                default:
                    borderOptions.dashArray = null;
            }

            const borderLine = L.polygon(stateAtTime.boundaries, borderOptions);
            borderLine.addTo(this.borderLayer);
        });
    }

    renderConflictZones(cycle) {
        this.conflicts.forEach((conflict, conflictId) => {
            const conflictAtTime = this.getConflictStateAtTime(conflict, cycle);
            if (!conflictAtTime || !conflictAtTime.zone) return;

            // Create animated conflict zone
            const conflictZone = L.polygon(conflictAtTime.zone, {
                fillColor: '#e74c3c',
                fillOpacity: conflictAtTime.intensity * 0.3,
                color: '#c0392b',
                weight: 2,
                opacity: conflictAtTime.intensity,
                interactive: true,
                className: 'conflict-zone'
            });

            conflictZone.bindPopup(`
                <div class="conflict-popup">
                    <h4>Conflict Zone</h4>
                    <p><strong>Participants:</strong> ${conflict.participants.map(p =>
                        this.factions[p]?.name || p).join(' vs ')}</p>
                    <p><strong>Intensity:</strong> ${Math.round(conflictAtTime.intensity * 100)}%</p>
                    <p><strong>Status:</strong> ${conflictAtTime.status.replace('_', ' ')}</p>
                    <p><strong>Cycle:</strong> ${cycle}</p>
                </div>
            `);

            conflictZone.addTo(this.conflictLayer);

            // Add pulsing effect for active conflicts
            if (conflictAtTime.intensity > 0.5) {
                conflictZone.getElement().classList.add('conflict-active');
            }
        });
    }

    renderTradeRoutes(cycle) {
        this.tradeRoutes.forEach((route, routeId) => {
            const routeAtTime = this.getTradeRouteStateAtTime(route, cycle);
            if (!routeAtTime || !routeAtTime.path) return;

            const lineWidth = Math.max(2, Math.min(8, routeAtTime.volume / 500));
            const opacity = Math.max(0.3, Math.min(1, routeAtTime.volume / 3000));

            const tradePath = L.polyline(routeAtTime.path, {
                color: '#f39c12',
                weight: lineWidth,
                opacity: opacity,
                interactive: true,
                className: 'trade-route'
            });

            tradePath.bindPopup(`
                <div class="trade-route-popup">
                    <h4>${route.name}</h4>
                    <p><strong>Volume:</strong> ${routeAtTime.volume} units</p>
                    <p><strong>Status:</strong> ${routeAtTime.status}</p>
                    <p><strong>Cycle:</strong> ${cycle}</p>
                </div>
            `);

            tradePath.addTo(this.tradeLayer);

            // Add animated flow markers for active routes
            if (routeAtTime.status === 'flourishing') {
                this.addTradeFlowAnimation(routeAtTime.path);
            }
        });
    }

    renderSettlements(cycle) {
        // Additional settlement markers beyond capitals
        const settlements = [
            { pos: [45, -95], name: 'Border Town', pop: 5000, type: 'town' },
            { pos: [35, -75], name: 'Trading Post', pop: 2000, type: 'post' },
            { pos: [52, -125], name: 'Mountain Fortress', pop: 8000, type: 'fortress' }
        ];

        settlements.forEach(settlement => {
            const marker = L.circleMarker(settlement.pos, {
                radius: settlement.type === 'fortress' ? 6 : 4,
                fillColor: settlement.type === 'fortress' ? '#8e44ad' : '#34495e',
                color: '#ffffff',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.6
            });

            marker.bindTooltip(settlement.name);
            marker.addTo(this.settlementLayer);
        });
    }

    addTradeFlowAnimation(path) {
        // Create animated dots moving along trade route
        const flowMarker = L.circleMarker(path[0], {
            radius: 3,
            fillColor: '#f1c40f',
            color: '#f39c12',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.8,
            interactive: false
        });

        flowMarker.addTo(this.tradeLayer);

        // Animate along path
        let pathIndex = 0;
        const animateFlow = () => {
            if (pathIndex < path.length - 1) {
                pathIndex++;
                flowMarker.setLatLng(path[pathIndex]);
                setTimeout(animateFlow, 200);
            } else {
                this.tradeLayer.removeLayer(flowMarker);
            }
        };

        setTimeout(animateFlow, 100);
    }

    getTerritorialStateAtTime(territory, cycle) {
        const timeline = territory.timeline.sort((a, b) => a.cycle - b.cycle);

        // Find the state at or before the given cycle
        let currentState = null;
        let nextState = null;

        for (let i = 0; i < timeline.length; i++) {
            if (timeline[i].cycle <= cycle) {
                currentState = timeline[i];
            }
            if (timeline[i].cycle > cycle && !nextState) {
                nextState = timeline[i];
                break;
            }
        }

        if (!currentState) return null;
        if (!nextState) return currentState;

        // Interpolate between states for smooth transitions
        const progress = (cycle - currentState.cycle) / (nextState.cycle - currentState.cycle);

        return {
            boundaries: this.interpolateBoundaries(currentState.boundaries, nextState.boundaries, progress),
            capital: currentState.capital, // Capitals don't interpolate
            population: Math.round(currentState.population + (nextState.population - currentState.population) * progress),
            status: progress < 0.5 ? currentState.status : nextState.status
        };
    }

    getConflictStateAtTime(conflict, cycle) {
        const timeline = conflict.timeline.sort((a, b) => a.cycle - b.cycle);

        for (let i = 0; i < timeline.length; i++) {
            if (i === timeline.length - 1 || timeline[i + 1].cycle > cycle) {
                if (timeline[i].cycle <= cycle) {
                    return timeline[i];
                }
                break;
            }
        }
        return null;
    }

    getTradeRouteStateAtTime(route, cycle) {
        const timeline = route.timeline.sort((a, b) => a.cycle - b.cycle);

        for (let i = 0; i < timeline.length; i++) {
            if (i === timeline.length - 1 || timeline[i + 1].cycle > cycle) {
                if (timeline[i].cycle <= cycle) {
                    return timeline[i];
                }
                break;
            }
        }
        return null;
    }

    interpolateBoundaries(boundaries1, boundaries2, progress) {
        if (!boundaries1 || !boundaries2 || boundaries1.length !== boundaries2.length) {
            return boundaries1;
        }

        return boundaries1.map((point1, index) => {
            const point2 = boundaries2[index];
            return [
                point1[0] + (point2[0] - point1[0]) * progress,
                point1[1] + (point2[1] - point1[1]) * progress
            ];
        });
    }

    animateTerritorialChanges(targetCycle) {
        if (this.isAnimating) return;

        this.isAnimating = true;
        const startCycle = this.currentTime.cycle;
        const cycleDifference = targetCycle - startCycle;
        const steps = Math.abs(cycleDifference) * 2; // 2 steps per cycle
        const stepDuration = this.options.animationDuration / steps;

        let currentStep = 0;

        const animate = () => {
            if (currentStep >= steps) {
                this.renderTerritorialState(targetCycle);
                this.isAnimating = false;
                return;
            }

            const progress = currentStep / steps;
            const intermediateCycle = startCycle + cycleDifference * progress;

            this.renderTerritorialState(intermediateCycle);

            currentStep++;
            this.animationTimer = setTimeout(animate, stepDuration);
        };

        animate();
    }

    clearLayers() {
        this.territoryLayer.clearLayers();
        this.borderLayer.clearLayers();
        this.conflictLayer.clearLayers();
        this.tradeLayer.clearLayers();
        this.settlementLayer.clearLayers();
    }

    // Public API methods
    setTerritoriesEnabled(enabled) {
        this.options.enableTerritories = enabled;
        if (enabled) {
            this.territoryLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.territoryLayer);
        }
        this.renderTerritorialState(this.currentTime.cycle);
    }

    setBordersEnabled(enabled) {
        this.options.showBorders = enabled;
        if (enabled) {
            this.borderLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.borderLayer);
        }
        this.renderTerritorialState(this.currentTime.cycle);
    }

    setConflictZonesEnabled(enabled) {
        this.options.showConflictZones = enabled;
        if (enabled) {
            this.conflictLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.conflictLayer);
        }
        this.renderTerritorialState(this.currentTime.cycle);
    }

    setTradeRoutesEnabled(enabled) {
        this.options.showTradeRoutes = enabled;
        if (enabled) {
            this.tradeLayer.addTo(this.map);
        } else {
            this.map.removeLayer(this.tradeLayer);
        }
        this.renderTerritorialState(this.currentTime.cycle);
    }

    setTerritoryOpacity(opacity) {
        this.options.territoryOpacity = Math.max(0, Math.min(1, opacity));
        this.renderTerritorialState(this.currentTime.cycle);
    }

    setBorderWidth(width) {
        this.options.borderWidth = Math.max(1, Math.min(5, width));
        this.renderTerritorialState(this.currentTime.cycle);
    }

    setAnimationSpeed(speed) {
        this.options.animationSpeed = Math.max(0.1, Math.min(5, speed));
        this.options.animationDuration = 2000 / speed;
    }

    setSmoothTransitions(enabled) {
        this.options.smoothTransitions = enabled;
    }

    getTerritorialStats() {
        return {
            totalTerritories: this.territories.size,
            activeConflicts: Array.from(this.conflicts.values()).filter(conflict =>
                this.getConflictStateAtTime(conflict, this.currentTime.cycle)
            ).length,
            activeTradeRoutes: Array.from(this.tradeRoutes.values()).filter(route =>
                this.getTradeRouteStateAtTime(route, this.currentTime.cycle)
            ).length,
            currentCycle: this.currentTime.cycle,
            isAnimating: this.isAnimating
        };
    }

    getFactionList() {
        return Object.entries(this.factions).map(([key, faction]) => ({
            id: key,
            name: faction.name,
            color: faction.color,
            pattern: faction.pattern,
            territories: Array.from(this.territories.values()).filter(t => t.faction === key).length
        }));
    }

    highlightFaction(factionId, highlight = true) {
        const faction = this.factions[factionId];
        if (!faction) return;

        // Update opacity for faction territories
        this.territoryLayer.eachLayer(layer => {
            if (layer.options.className === `territory-${factionId}`) {
                layer.setStyle({
                    fillOpacity: highlight ? this.options.territoryOpacity * 1.5 : this.options.territoryOpacity,
                    opacity: highlight ? 1 : 0.8
                });
            }
        });
    }

    stopAnimation() {
        if (this.animationTimer) {
            clearTimeout(this.animationTimer);
            this.animationTimer = null;
        }
        this.isAnimating = false;
    }

    destroy() {
        this.stopAnimation();

        if (this.territoryLayer) this.map.removeLayer(this.territoryLayer);
        if (this.borderLayer) this.map.removeLayer(this.borderLayer);
        if (this.conflictLayer) this.map.removeLayer(this.conflictLayer);
        if (this.tradeLayer) this.map.removeLayer(this.tradeLayer);
        if (this.settlementLayer) this.map.removeLayer(this.settlementLayer);

        this.territories.clear();
        this.borders.clear();
        this.conflicts.clear();
        this.tradeRoutes.clear();
        this.settlements.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TerritoryAnimationSystem;
}