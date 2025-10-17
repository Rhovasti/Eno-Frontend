let map;
let currentZoom = 3;
let currentLevel = 'world';
let currentContext = { level: 'world' };
let layers = {
    citystates: null,
    regions: null,
    districts: {},
    buildings: {},
    floors: {},
    games: null,
    wiki: null,
    trade: null,
    population: null,
    resources: null
};
let markers = {};

// Performance optimization: caching and debouncing
let dataCache = {};
let loadingStates = {};
let zoomDebounceTimer = null;
const DEBOUNCE_DELAY = 300;

// Request deduplication
const pendingRequests = new Map();

// URL state update debouncing
let urlUpdateTimer = null;
const URL_UPDATE_DELAY = 1000;

// Layer visibility toggles
let layerVisibility = {
    citystates: true,
    regions: true,
    districts: true,
    buildings: true,
    games: true,
    gamesActive: false,
    gamesRecruiting: false,
    wiki: false,
    historical: false,
    trade: false,
    population: false,
    resources: false,
    floors: true
};

// Game filter state
let gameFilters = {
    showActive: true,
    showRecruiting: true,
    showArchived: false
};

// Search functionality
let searchIndex = [];
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_DELAY = 250;

const ZOOM_LEVELS = {
    WORLD: { min: 0, max: 3, name: 'World' },
    REGION: { min: 4, max: 5, name: 'Regional' },
    CITYSTATE: { min: 6, max: 8, name: 'Citystate' },
    DISTRICT: { min: 9, max: 12, name: 'District' },
    BUILDING: { min: 13, max: 16, name: 'Building Interior' }
};

const COLORS = {
    region: '#3498db',
    citystate: '#e74c3c',
    district: '#f39c12',
    building_residential: '#2ecc71',
    building_commercial: '#9b59b6',
    building_industrial: '#34495e',
    building_religious: '#e67e22',
    building_military: '#c0392b',
    building_other: '#95a5a6',
    room: '#ecf0f1',
    game_active: '#27ae60',
    game_recruiting: '#f39c12',
    game_archived: '#95a5a6'
};

const ROOM_COLORS = {
    bedroom: '#a8d5e2',
    bathroom: '#76c7c0',
    kitchen: '#f4a261',
    living_room: '#e9c46a',
    dining_room: '#f4a261',
    office: '#2a9d8f',
    study: '#2a9d8f',
    hallway: '#e0e0e0',
    corridor: '#e0e0e0',
    storage: '#95a5a6',
    closet: '#95a5a6',
    commercial: '#9b59b6',
    shop: '#9b59b6',
    warehouse: '#7f8c8d',
    workshop: '#d35400',
    stable: '#c0392b',
    tavern: '#e67e22',
    inn: '#e67e22',
    chapel: '#8e44ad',
    shrine: '#8e44ad',
    guard_room: '#c0392b',
    armory: '#34495e',
    library: '#16a085',
    default: '#ecf0f1'
};

function getRoomColor(roomType) {
    if (!roomType) return ROOM_COLORS.default;
    const normalizedType = roomType.toLowerCase().replace(/[_\s]+/g, '_');
    return ROOM_COLORS[normalizedType] || ROOM_COLORS.default;
}

// Custom marker styles
const MARKER_STYLES = {
    citystate: {
        radius: (population) => Math.max(Math.sqrt(population / 100) + 3, 4),
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    },
    region: {
        radius: 12,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7
    },
    game: {
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        className: 'game-marker'
    }
};

function initMap() {
    map = L.map('map', {
        center: [5, 23],
        zoom: 3,
        minZoom: 0,
        maxZoom: 18,
        zoomControl: true,
        zoomAnimation: true,
        zoomAnimationThreshold: 10,
        fadeAnimation: true,
        markerZoomAnimation: true,
        inertia: true,
        inertiaDeceleration: 3000,
        inertiaMaxSpeed: 1500
    });

    L.tileLayer('https://rhovasti.github.io/eno-tiles/{z}/{x}/{y}.png', {
        attribution: 'Eno World Map - Custom satellite imagery',
        minZoom: 0,
        maxZoom: 8,
        opacity: 0.8,
        tms: true
    }).addTo(map);

    map.on('zoomend', handleZoomChange);
    map.on('moveend', handleViewChange);

    initLayerControls();
    initSearchSystem();
    initKeyboardNavigation();
    initAccessibility();

    if (!loadURLState()) {
        loadWorldData();
    } else {
        loadWorldData();
    }

    updateLegend();

    map.on('moveend', debounceURLUpdate);
    map.on('zoomend', debounceURLUpdate);
}

function initLayerControls() {
    const toggles = [
        'citystates', 'regions', 'districts', 'buildings', 'games', 'wiki'
    ];

    toggles.forEach(layerName => {
        const checkbox = document.getElementById(`layer-${layerName}`);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                layerVisibility[layerName] = checkbox.checked;
                toggleLayer(layerName, checkbox.checked);
            });
        }
    });

    const gamesActive = document.getElementById('layer-games-active');
    if (gamesActive) {
        gamesActive.addEventListener('change', () => {
            layerVisibility.gamesActive = gamesActive.checked;
            if (gamesActive.checked) {
                document.getElementById('layer-games-recruiting').checked = false;
                layerVisibility.gamesRecruiting = false;
            }
            displayGames();
        });
    }

    const gamesRecruiting = document.getElementById('layer-games-recruiting');
    if (gamesRecruiting) {
        gamesRecruiting.addEventListener('change', () => {
            layerVisibility.gamesRecruiting = gamesRecruiting.checked;
            if (gamesRecruiting.checked) {
                document.getElementById('layer-games-active').checked = false;
                layerVisibility.gamesActive = false;
            }
            displayGames();
        });
    }
}

function toggleLayer(layerName, visible) {
    if (layerName === 'citystates' && layers.citystates) {
        if (visible) {
            map.addLayer(layers.citystates);
        } else {
            map.removeLayer(layers.citystates);
        }
    } else if (layerName === 'regions' && layers.regions) {
        if (visible) {
            map.addLayer(layers.regions);
        } else {
            map.removeLayer(layers.regions);
        }
    } else if (layerName === 'games') {
        if (visible) {
            displayGames();
        } else if (layers.games) {
            map.removeLayer(layers.games);
        }
    } else if (layerName === 'wiki') {
        if (visible) {
            displayWikiMarkers();
        } else if (layers.wiki) {
            map.removeLayer(layers.wiki);
        }
    } else if (layerName === 'districts') {
        Object.values(layers.districts).forEach(layer => {
            if (layer) {
                if (visible) {
                    map.addLayer(layer);
                } else {
                    map.removeLayer(layer);
                }
            }
        });
    } else if (layerName === 'buildings') {
        Object.values(layers.buildings).forEach(layer => {
            if (layer) {
                if (visible) {
                    map.addLayer(layer);
                } else {
                    map.removeLayer(layer);
                }
            }
        });
    }
}

function initSearchSystem() {
    const searchInput = document.getElementById('mapSearch');
    const searchResults = document.getElementById('searchResults');

    if (!searchInput || !searchResults) {
        console.warn('Search elements not found');
        return;
    }

    // Build search index from loaded data
    buildSearchIndex();

    // Add event listeners
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.length > 0) {
            searchResults.classList.add('visible');
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            searchResults.classList.remove('visible');
        }
    });
}

async function buildSearchIndex() {
    await buildIntegratedSearchIndex();
}

function handleSearchInput(e) {
    const query = e.target.value.trim();

    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
        performSearch(query);
    }, SEARCH_DEBOUNCE_DELAY);
}

function performSearch(query) {
    const searchResults = document.getElementById('searchResults');

    if (query.length < 2) {
        searchResults.classList.remove('visible');
        return;
    }

    // Simple fuzzy search implementation
    const results = searchIndex.filter(item => {
        const name = item.name.toLowerCase();
        const queryLower = query.toLowerCase();
        return name.includes(queryLower) ||
               name.split(' ').some(word => word.startsWith(queryLower));
    }).slice(0, 8); // Limit to 8 results

    displaySearchResults(results);
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('searchResults');

    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item"><div class="search-result-title">No results found</div></div>';
        searchResults.classList.add('visible');
        return;
    }

    const html = results.map(result => `
        <div class="search-result-item" onclick="jumpToLocation('${result.type}', '${result.name}', ${result.coordinates[0]}, ${result.coordinates[1]}, ${result.zoom})">
            <div class="search-result-title">
                <span class="search-result-icon">${result.icon || ''}</span>
                ${result.name}
                <span class="search-result-type ${result.type}">${result.type}</span>
            </div>
            <div class="search-result-subtitle">${result.subtitle}</div>
        </div>
    `).join('');

    searchResults.innerHTML = html;
    searchResults.classList.add('visible');
}

function jumpToLocation(type, name, lat, lon, zoom) {
    // Hide search results
    document.getElementById('searchResults').classList.remove('visible');
    document.getElementById('mapSearch').blur();

    // Animate to location
    map.flyTo([lat, lon], zoom, {
        duration: 1.5,
        easeLinearity: 0.25
    });

    // Update context and load appropriate data
    if (type === 'citystate') {
        currentContext = { level: 'citystate', cityName: name.toLowerCase(), lat, lon };
        setTimeout(() => {
            loadCitystateData(name.toLowerCase());
            updateBreadcrumb();
        }, 1000);
    } else if (type === 'region') {
        currentContext = { level: 'region', regionName: name, lat, lon };
        updateBreadcrumb();
    }
}

function handleZoomChange() {
    currentZoom = map.getZoom();
    updateZoomIndicator();

    // Debounce level transitions to avoid excessive API calls
    if (zoomDebounceTimer) {
        clearTimeout(zoomDebounceTimer);
    }

    zoomDebounceTimer = setTimeout(() => {
        const newLevel = getZoomLevel(currentZoom);
        if (newLevel !== currentLevel) {
            currentLevel = newLevel;
            handleLevelTransition();
        }
    }, DEBOUNCE_DELAY);
}

function getZoomLevel(zoom) {
    if (zoom >= ZOOM_LEVELS.BUILDING.min) return 'building';
    if (zoom >= ZOOM_LEVELS.DISTRICT.min) return 'district';
    if (zoom >= ZOOM_LEVELS.CITYSTATE.min) return 'citystate';
    if (zoom >= ZOOM_LEVELS.REGION.min) return 'region';
    return 'world';
}

function updateZoomIndicator() {
    document.getElementById('zoomValue').textContent = currentZoom;
    const levelName = ZOOM_LEVELS[currentLevel.toUpperCase()]?.name || currentLevel;
    document.getElementById('zoomLevel').textContent = levelName;
}

async function loadWorldData() {
    showLoading(true);
    try {
        const response = await fetch('/api/maps/regions');
        const data = await response.json();

        if (data.success) {
            displayCitystates();
            displayGames();

            // Rebuild search index after data is loaded
            setTimeout(() => {
                buildSearchIndex();
            }, 500);
        }
    } catch (error) {
        console.error('Error loading world data:', error);
    } finally {
        showLoading(false);
    }
}

async function displayCitystates() {
    if (!layerVisibility.citystates) return;

    if (layers.citystates) {
        map.removeLayer(layers.citystates);
    }

    // Load citystate data from the working API endpoint that the CitystateMapViewer uses
    try {
        // Check cache first
        let data;
        if (dataCache['citystates']) {
            data = dataCache['citystates'];
        } else {
            const response = await fetch('/api/citystates'); // Backend uses /api/citystates (not /api/maps/citystates)
            data = await response.json();
            dataCache['citystates'] = data;
        }

        if (!data.success || !data.citystates) {
            throw new Error('Failed to load citystates');
        }

        const citystates = L.layerGroup();

        data.citystates.forEach(citystate => {
            // Skip if missing critical data
            if (!citystate.name || !citystate.center || !citystate.center.lat || !citystate.center.lng) return;

            const population = citystate.building_count || 0; // Use building count as population proxy
            const latLng = [citystate.center.lat, citystate.center.lng];

            // Create marker with enhanced styling
            const style = MARKER_STYLES.citystate;
            const marker = L.circleMarker(latLng, {
                radius: style.radius(population),
                fillColor: COLORS.citystate,
                color: style.color,
                weight: style.weight,
                opacity: style.opacity,
                fillOpacity: style.fillOpacity,
                className: 'citystate-marker',
                bubblingMouseEvents: false
            });

            const cityId = citystate.name.toLowerCase();
            const displayName = citystate.display_name || citystate.name;
            marker.bindPopup(`
                <div class="map-popup">
                    <strong>${displayName}</strong><br>
                    Buildings: ${citystate.building_count || 0}<br>
                    Features: ${citystate.feature_count || 0}<br>
                    <div class="popup-buttons">
                        <button onclick="zoomToCitystate('${cityId}', ${latLng[0]}, ${latLng[1]})">View Details</button>
                        <button onclick="viewCitystateWiki('${cityId}', '${displayName}')">📖 Wiki</button>
                        <button onclick="startGameHere(${latLng[0]}, ${latLng[1]}, 'citystate', '${cityId}')">🎯 Start Game Here</button>
                    </div>
                    <div id="wiki-preview-${cityId}" class="wiki-preview"></div>
                </div>
            `);

            // Add consistent hover effects
            const originalStyle = {
                weight: style.weight,
                fillOpacity: style.fillOpacity
            };

            marker.on('mouseover', function(e) {
                L.DomEvent.stopPropagation(e);
                // Only apply hover if marker is still on map
                if (map.hasLayer(this)) {
                    this.setStyle({
                        weight: 3,
                        fillOpacity: 0.95
                    });
                }
            });

            marker.on('mouseout', function(e) {
                L.DomEvent.stopPropagation(e);
                // Only revert if marker is still on map
                if (map.hasLayer(this)) {
                    this.setStyle(originalStyle);
                }
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                currentContext = {
                    level: 'citystate',
                    citystate: citystate.name.toLowerCase(),
                    lat: latLng[0],
                    lon: latLng[1]
                };
                map.setView(latLng, 10);
                updateBreadcrumb();
                loadCitystateData(citystate.name.toLowerCase());
            });

            citystates.addLayer(marker);
        });

        layers.citystates = citystates;
        layers.citystates.addTo(map);

        // Fit bounds to all citystates using working coordinates
        const validCoords = data.citystates
            .filter(c => c.center && c.center.lat && c.center.lng)
            .map(c => [c.center.lat, c.center.lng]);

        if (validCoords.length > 0) {
            const bounds = L.latLngBounds(validCoords);
            map.fitBounds(bounds, { padding: [50, 50] });
        }

    } catch (error) {
        console.error('Error loading citystate data:', error);
        // Fallback to mock data if real data fails
        const citystates = L.layerGroup();

        const mockCitystates = [
            { name: 'Malveiba', coords: [78.43, -70.13], population: 12500 },
            { name: 'Alebuo', coords: [75.2, -68.5], population: 25000 },
            { name: 'Aira', coords: [80.1, -72.3], population: 8000 }
        ];

        mockCitystates.forEach(city => {
            const marker = L.circleMarker([city.coords[1], city.coords[0]], {
                radius: 6,
                fillColor: COLORS.citystate,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            });

            marker.bindPopup(`
                <div class="popup-title">${city.name}</div>
                <div class="popup-info">
                    Population: ${city.population.toLocaleString()}<br>
                    <a href="#" onclick="zoomToCitystate('${city.name}', ${city.coords[1]}, ${city.coords[0]}); return false;">
                        View Citystate →
                    </a>
                </div>
            `);

            marker.on('click', () => {
                showCitystateInfo(city);
            });

            marker.addTo(citystates);
        });

        layers.citystates = citystates.addTo(map);
    }
}

async function displayGames() {
    if (!layerVisibility.games) return;

    if (layers.games) {
        map.removeLayer(layers.games);
    }

    try {
        let data;
        if (dataCache['games']) {
            data = dataCache['games'];
        } else {
            const response = await fetch('/api/maps/games');
            data = await response.json();
            dataCache['games'] = data;
        }

        if (!data.success || !data.games) {
            console.warn('No games data available');
            return;
        }

        const games = L.layerGroup();

        data.games.forEach(game => {
            if (!game.latitude || !game.longitude) return;

            const latLng = [game.latitude, game.longitude];

            let color = COLORS.game_archived;
            let status = 'Archived';
            let icon = '📚';

            if (!game.is_archived) {
                if (game.player_count < 4) {
                    color = COLORS.game_recruiting;
                    status = 'Recruiting';
                    icon = '📢';
                } else {
                    color = COLORS.game_active;
                    status = 'Active';
                    icon = '🎮';
                }
            }

            if (!gameFilters.showActive && status === 'Active') return;
            if (!gameFilters.showRecruiting && status === 'Recruiting') return;
            if (!gameFilters.showArchived && status === 'Archived') return;

            if (layerVisibility.gamesActive && status !== 'Active') return;
            if (layerVisibility.gamesRecruiting && status !== 'Recruiting') return;

            const marker = L.marker(latLng, {
                icon: L.divIcon({
                    className: `game-marker game-marker-${status.toLowerCase()}`,
                    html: `<div class="game-icon" style="background-color: ${color}; animation: ${status !== 'Archived' ? 'pulse 2s infinite' : 'none'};">${icon}</div>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                })
            });

            const locationInfo = game.location_type && game.location_id
                ? `${game.location_type}: ${game.location_id}`
                : 'Custom Location';

            marker.bindPopup(`
                <div class="map-popup game-popup">
                    <div class="popup-header">
                        <strong>${icon} ${game.name}</strong>
                        <span class="game-status-badge ${status.toLowerCase()}">${status}</span>
                    </div>
                    <div class="popup-content">
                        <p>${game.description ? game.description.substring(0, 150) + '...' : 'No description'}</p>
                        <div style="margin-top:8px;">
                            <strong>GM:</strong> ${game.gm_username || 'None'}<br>
                            <strong>Players:</strong> ${game.player_count}/4<br>
                            <strong>Genre:</strong> ${game.genre || 'General'}<br>
                            <strong>Location:</strong> ${locationInfo}
                        </div>
                    </div>
                    <div class="popup-buttons">
                        ${status === 'Recruiting' ? `<button onclick="joinGame(${game.id})">Join Game</button>` : ''}
                        <button onclick="viewGame(${game.id})">View Details</button>
                        <button onclick="startGameHere(${game.latitude}, ${game.longitude}, '${game.location_type || ''}', '${game.location_id || ''}')">🎯 Start Game Here</button>
                    </div>
                </div>
            `);

            marker.on('click', () => {
                console.log('Game clicked:', game);
            });

            games.addLayer(marker);
        });

        layers.games = games;
        layers.games.addTo(map);

    } catch (error) {
        console.error('Error loading games data:', error);
    }
}

function zoomToCitystate(name, lat, lon) {
    currentContext = { level: 'citystate', cityName: name, lat, lon };
    map.setView([lat, lon], 10);
    updateBreadcrumb();
    loadCitystateData(name);
}

async function loadCitystateData(cityName) {
    showLoading(true);
    try {
        const response = await fetch(`/api/maps/citystates/${cityName}/districts`);

        if (!response.ok) {
            console.warn(`No district data available for ${cityName}`);
            showInfoPanel(`
                <h3>${cityName}</h3>
                <p>District data not yet available for this citystate.</p>
                <p>Only Malveiba has full district and building data currently.</p>
            `);
            return;
        }

        const data = await response.json();

        if (data.success) {
            // Cache district data for this citystate
            const cacheKey = `citystate_${cityName}`;
            dataCache[cacheKey] = { districts: data.districts };

            displayDistricts(cityName, data.districts);
        }
    } catch (error) {
        console.error('Error loading citystate data:', error);
        showInfoPanel(`
            <h3>${cityName}</h3>
            <p>Error loading data for this citystate.</p>
        `);
    } finally {
        showLoading(false);
    }
}

async function displayDistricts(cityName, districts) {
    if (!layerVisibility.districts) return;

    if (layers.districts[cityName]) {
        map.removeLayer(layers.districts[cityName]);
    }

    const districtLayer = L.layerGroup();

    for (const district of districts) {
        try {
            // Check cache first
            const cacheKey = `district_${cityName}_${district.name}`;
            let districtData;

            if (dataCache[cacheKey]) {
                districtData = dataCache[cacheKey];
            } else {
                const response = await fetch(`/api/maps/citystates/${cityName}/districts/${district.name}`);
                districtData = await response.json();
                dataCache[cacheKey] = districtData;
            }

            if (districtData.features && districtData.features.districtBoundary) {
                L.geoJSON(districtData.features.districtBoundary, {
                    style: {
                        color: COLORS.district,
                        weight: 2,
                        fillColor: COLORS.district,
                        fillOpacity: 0.2
                    },
                    onEachFeature: (feature, layer) => {
                        layer.bindPopup(`
                            <div class="popup-title">${district.name}</div>
                            <div class="popup-info">
                                Type: ${district.type}<br>
                                Era: ${district.era}<br>
                                Buildings: ${districtData.metadata.buildingCount}<br>
                                <a href="#" onclick="showDistrictDetails('${cityName}', '${district.name}'); return false;">
                                    View Details →
                                </a>
                            </div>
                        `);

                        layer.on('click', () => {
                            currentContext.districtName = district.name;
                            updateBreadcrumb();
                        });
                    }
                }).addTo(districtLayer);
            }
        } catch (error) {
            console.error(`Error loading district ${district.name}:`, error);
        }
    }

    layers.districts[cityName] = districtLayer.addTo(map);
}

async function showDistrictDetails(cityName, districtName) {
    showLoading(true);
    try {
        const response = await fetch(`/api/maps/citystates/${cityName}/districts/${districtName}`);
        const data = await response.json();

        currentContext = { level: 'district', cityName, districtName };
        updateBreadcrumb();

        if (data.bounds) {
            const [minLon, minLat, maxLon, maxLat] = data.bounds;
            map.fitBounds([[minLat, minLon], [maxLat, maxLon]]);
        }

        // Cache buildings data
        const buildingsCacheKey = `buildings_${cityName}_${districtName}`;
        dataCache[buildingsCacheKey] = data.features.buildings;

        displayBuildings(cityName, districtName, data.features.buildings);
        showDistrictInfo(data);
    } catch (error) {
        console.error('Error loading district details:', error);
    } finally {
        showLoading(false);
    }
}

function displayBuildings(cityName, districtName, buildingsData) {
    if (!layerVisibility.buildings) return;

    const key = `${cityName}_${districtName}`;
    if (layers.buildings[key]) {
        map.removeLayer(layers.buildings[key]);
    }

    const buildingLayer = L.layerGroup();

    // Get current cycle if temporal system is active
    const currentCycle = window.temporalExtension ?
        window.temporalExtension.getCurrentTime().cycle : 998;

    // Update temporal cache if function exists
    if (window.displayBuildingsWithTemporalData) {
        window.displayBuildingsWithTemporalData(cityName, districtName, buildingsData, currentCycle);
    }

    buildingsData.features.forEach(building => {
        const type = building.properties.type || 'other';
        const specificType = building.properties.specific_type || '';
        const buildingId = building.properties.id;
        const age = building.properties.age || 10;
        const generation = building.properties.generation || 1;

        // Calculate temporal properties
        const constructionCycle = 998 - age;
        const isVisible = currentCycle >= constructionCycle;

        // Skip buildings not yet built
        if (!isVisible) return;

        // Calculate condition-based opacity
        const ageAtCurrentCycle = currentCycle - constructionCycle;
        let fillOpacity = 0.6;
        if (ageAtCurrentCycle < 10) fillOpacity = 0.8; // New buildings more vibrant
        else if (ageAtCurrentCycle < 100) fillOpacity = 0.7;
        else if (ageAtCurrentCycle < 300) fillOpacity = 0.6;
        else if (ageAtCurrentCycle < 500) fillOpacity = 0.5;
        else fillOpacity = 0.4; // Ancient buildings more faded

        // Enhanced color mapping based on specific building types
        let color = COLORS.building_other;
        if (specificType.toLowerCase().includes('church') || specificType.toLowerCase().includes('temple')) {
            color = COLORS.building_religious;
        } else if (specificType.toLowerCase().includes('military') || specificType.toLowerCase().includes('guard')) {
            color = COLORS.building_military;
        } else if (specificType.toLowerCase().includes('factory') || specificType.toLowerCase().includes('mill')) {
            color = COLORS.building_industrial;
        } else {
            color = COLORS[`building_${type}`] || COLORS.building_other;
        }

        const feature = L.geoJSON(building, {
            style: {
                color: color,
                weight: 1,
                fillColor: color,
                fillOpacity: fillOpacity
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;

                // Get temporal lifecycle info if available
                let lifecycleInfo = '';
                if (window.getBuildingLifecycleInfo) {
                    const info = window.getBuildingLifecycleInfo(buildingId, currentCycle);
                    if (info) {
                        lifecycleInfo = `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd;">
                                <strong>Built:</strong> Cycle ${info.constructionCycle}<br>
                                <strong>Age:</strong> ${info.ageAtCurrentCycle} years<br>
                                <strong>Generation:</strong> ${info.generation}<br>
                                <strong>Condition:</strong> ${info.condition}
                            </div>
                        `;
                    }
                }

                layer.bindPopup(`
                    <div class="popup-title">${props.specific_type || props.type}</div>
                    <div class="popup-info">
                        Type: ${props.type}<br>
                        Floors: ${props.floors || 1}<br>
                        Age: ${props.age || 'Unknown'} years (at C998)<br>
                        Generation: ${generation}
                        ${lifecycleInfo}
                        <a href="#" onclick="showBuildingDetails('${cityName}', '${props.id}'); return false;">
                            Explore Interior →
                        </a>
                    </div>
                `);

                layer.on('click', () => {
                    currentContext.buildingId = props.id;
                    updateBreadcrumb();
                });
            }
        });

        feature.addTo(buildingLayer);
    });

    layers.buildings[key] = buildingLayer.addTo(map);

    // Log temporal info
    const totalBuildings = buildingsData.features.length;
    const visibleBuildings = buildingLayer.getLayers().length;
    console.log(`Cycle ${currentCycle}: Displaying ${visibleBuildings}/${totalBuildings} buildings in ${districtName}`);
}

async function showBuildingDetails(cityName, buildingId) {
    showLoading(true);
    try {
        const response = await fetch(`/api/maps/citystates/${cityName}/buildings/${buildingId}`);
        const data = await response.json();

        currentContext = { level: 'building', cityName, buildingId };
        currentContext.buildingData = data;
        updateBreadcrumb();

        if (data.metadata && data.metadata.center) {
            map.setView([data.metadata.center[1], data.metadata.center[0]], 19);
        }

        showBuildingInfo(data);
        showFloorSelector(cityName, buildingId, data.metadata.floors);

        loadFloorPlan(cityName, buildingId, 0);
    } catch (error) {
        console.error('Error loading building details:', error);
    } finally {
        showLoading(false);
    }
}

async function loadFloorPlan(cityName, buildingId, floorLevel) {
    showLoading(true);
    try {
        const response = await fetch(`/api/maps/citystates/${cityName}/buildings/${buildingId}/floor/${floorLevel}`);
        const data = await response.json();

        displayFloorPlan(data);
        currentContext.floorLevel = floorLevel;
    } catch (error) {
        console.error('Error loading floor plan:', error);
    } finally {
        showLoading(false);
    }
}

function displayFloorPlan(floorData) {
    const key = `${currentContext.buildingId}_${currentContext.floorLevel}`;
    if (layers.floors[key]) {
        map.removeLayer(layers.floors[key]);
    }

    const floorLayer = L.layerGroup();

    floorData.features.forEach(feature => {
        if (feature.properties.feature_type === 'room') {
            const roomType = feature.properties.type || feature.properties.room_type;
            const roomColor = getRoomColor(roomType);

            L.geoJSON(feature, {
                style: {
                    color: '#34495e',
                    weight: 2,
                    fillColor: roomColor,
                    fillOpacity: 0.7
                },
                onEachFeature: (feat, layer) => {
                    const props = feat.properties;
                    const roomName = props.name || `Room ${props.id || ''}`;
                    const roomTypeDisplay = props.type || props.room_type || 'Unknown';
                    const area = props.area ? `${props.area.toFixed(1)} m²` : 'N/A';

                    // Mark floor room elements to avoid CSS hover conflicts
                    if (layer.getElement) {
                        setTimeout(() => {
                            const element = layer.getElement();
                            if (element) element.setAttribute('data-floor-room', 'true');
                        }, 0);
                    }

                    layer.bindPopup(`
                        <div class="map-popup">
                            <strong>${roomName}</strong><br>
                            <div style="margin-top:8px;">
                                Type: ${roomTypeDisplay}<br>
                                Area: ${area}
                                ${props.description ? `<br><em>${props.description}</em>` : ''}
                            </div>
                        </div>
                    `);

                    // Store original style to prevent conflicts
                    const originalStyle = {
                        weight: 2,
                        fillOpacity: 0.7
                    };

                    layer.on('mouseover', function(e) {
                        // Only apply hover effect if layer is still on the map
                        if (map.hasLayer(this)) {
                            this.setStyle({
                                weight: 3,
                                fillOpacity: 0.9
                            });
                        }
                    });

                    layer.on('mouseout', function(e) {
                        // Only revert style if layer is still on the map
                        if (map.hasLayer(this)) {
                            this.setStyle(originalStyle);
                        }
                    });
                }
            }).addTo(floorLayer);
        } else if (feature.properties.feature_type === 'stairs') {
            L.circleMarker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], {
                radius: 5,
                fillColor: '#e74c3c',
                color: '#fff',
                weight: 2,
                fillOpacity: 1
            }).bindPopup(`
                <div class="map-popup">
                    <strong>Stairs</strong><br>
                    ${feature.properties.connects ? `Connects to: ${feature.properties.connects}` : ''}
                </div>
            `).addTo(floorLayer);
        } else if (feature.properties.feature_type === 'door') {
            L.polyline(
                [[feature.geometry.coordinates[0][1], feature.geometry.coordinates[0][0]],
                 [feature.geometry.coordinates[1][1], feature.geometry.coordinates[1][0]]],
                {
                    color: '#34495e',
                    weight: 3,
                    opacity: 0.8
                }
            ).addTo(floorLayer);
        }
    });

    layers.floors[key] = floorLayer.addTo(map);
}

function showFloorSelector(cityName, buildingId, floors) {
    const selector = document.getElementById('floorSelector');
    selector.innerHTML = '<h4>Select Floor</h4>';

    floors.sort((a, b) => b.level - a.level);

    floors.forEach(floor => {
        const btn = document.createElement('button');
        btn.className = 'floor-btn';

        let floorLabel = '';
        if (floor.level < 0) {
            floorLabel = `B${Math.abs(floor.level)}`;
        } else if (floor.level === 0) {
            floorLabel = 'Ground';
        } else {
            floorLabel = `Floor ${floor.level}`;
        }

        const roomCount = floor.room_count || floor.roomCount || 0;
        btn.innerHTML = `
            <div class="floor-label">${floorLabel}</div>
            <div class="floor-info">${roomCount} rooms</div>
        `;

        btn.onclick = () => {
            document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadFloorPlan(cityName, buildingId, floor.level);
        };
        if (floor.level === 0) btn.classList.add('active');
        selector.appendChild(btn);
    });

    selector.classList.add('visible');
}

function handleLevelTransition() {
    console.log(`Level transition: ${currentLevel} at zoom ${currentZoom}`);

    if (currentLevel === 'world') {
        // World view: show citystates, hide everything else
        hideAllLayers();
        displayCitystates();
        displayGames();
    } else if (currentLevel === 'region') {
        // Regional view: show regions + citystates
        hideDistrictsAndBuildings();
        loadRegionalView();
        displayCitystates();
        displayGames();
    } else if (currentLevel === 'citystate') {
        // Citystate view: show citystate detail
        if (layers.regions) {
            map.removeLayer(layers.regions);
        }
        // Ensure districts are visible if context is set
        if (currentContext.cityName && layerVisibility.districts) {
            const cacheKey = `citystate_${currentContext.cityName}`;
            if (dataCache[cacheKey] && dataCache[cacheKey].districts) {
                displayDistricts(currentContext.cityName, dataCache[cacheKey].districts);
            }
        }
    } else if (currentLevel === 'district') {
        // District view: ensure districts are visible
        if (currentContext.cityName && layerVisibility.districts) {
            const districtKey = currentContext.cityName;
            const cacheKey = `citystate_${currentContext.cityName}`;

            // Check if districts layer exists and is on map
            if (layers.districts[districtKey] && map.hasLayer(layers.districts[districtKey])) {
                console.log(`District layer already visible for ${currentContext.cityName}`);
            } else if (dataCache[cacheKey] && dataCache[cacheKey].districts) {
                // Re-display districts from cache
                console.log(`Restoring districts from cache for ${currentContext.cityName}`);
                displayDistricts(currentContext.cityName, dataCache[cacheKey].districts);
            } else {
                // Data not in cache - need to load it
                console.log(`Loading district data for ${currentContext.cityName}`);
                loadCitystateData(currentContext.cityName);
            }
        }
        // Load buildings for the current district if set
        if (currentContext.cityName && currentContext.districtName && layerVisibility.buildings) {
            const buildingKey = `${currentContext.cityName}_${currentContext.districtName}`;
            const buildingsCacheKey = `buildings_${currentContext.cityName}_${currentContext.districtName}`;

            // Check if buildings layer exists and is on map
            if (layers.buildings[buildingKey] && map.hasLayer(layers.buildings[buildingKey])) {
                console.log(`Building layer already visible for ${currentContext.districtName}`);
            } else if (dataCache[buildingsCacheKey]) {
                // Re-display buildings from cache
                console.log(`Restoring buildings from cache for ${currentContext.districtName}`);
                displayBuildings(currentContext.cityName, currentContext.districtName, dataCache[buildingsCacheKey]);
            } else {
                // Data not in cache - need to load it
                console.log(`Loading building data for ${currentContext.districtName}`);
                showDistrictDetails(currentContext.cityName, currentContext.districtName);
            }
        }
    } else if (currentLevel === 'building') {
        // Building view: ensure buildings are visible at building zoom level
        if (currentContext.cityName && currentContext.districtName && layerVisibility.buildings) {
            const buildingKey = `${currentContext.cityName}_${currentContext.districtName}`;
            const buildingsCacheKey = `buildings_${currentContext.cityName}_${currentContext.districtName}`;

            // Check if building layer exists and is on map
            if (layers.buildings[buildingKey] && map.hasLayer(layers.buildings[buildingKey])) {
                console.log(`Building layer already visible at building zoom`);
            } else if (layers.buildings[buildingKey]) {
                // Layer exists but not on map - re-add it
                console.log(`Re-adding existing building layer to map`);
                map.addLayer(layers.buildings[buildingKey]);
            } else if (dataCache[buildingsCacheKey]) {
                // Try to load from cache if layer doesn't exist yet
                console.log(`Restoring building layer from cache`);
                displayBuildings(currentContext.cityName, currentContext.districtName, dataCache[buildingsCacheKey]);
            } else {
                // Data not available - need to load it
                console.log(`Loading building data for district ${currentContext.districtName}`);
                showDistrictDetails(currentContext.cityName, currentContext.districtName);
            }
        }
    }
    updateLegend();
}

function hideDistrictsAndBuildings() {
    Object.values(layers.districts).forEach(layer => {
        if (layer) map.removeLayer(layer);
    });
    Object.values(layers.buildings).forEach(layer => {
        if (layer) map.removeLayer(layer);
    });
    Object.values(layers.floors).forEach(layer => {
        if (layer) map.removeLayer(layer);
    });
    document.getElementById('floorSelector').classList.remove('visible');
}

function zoomToRegion(regionName, lat, lon) {
    currentContext = { level: 'region', regionName, lat, lon };
    map.flyTo([lat, lon], 5, {
        duration: 1.5,
        easeLinearity: 0.25
    });
    updateBreadcrumb();
}

function hideAllLayers() {
    Object.values(layers.districts).forEach(layer => {
        if (layer) map.removeLayer(layer);
    });
    Object.values(layers.buildings).forEach(layer => {
        if (layer) map.removeLayer(layer);
    });
    Object.values(layers.floors).forEach(layer => {
        if (layer) map.removeLayer(layer);
    });
    document.getElementById('floorSelector').classList.remove('visible');
}

function handleViewChange() {
}

async function loadRegionalView() {
    if (!layerVisibility.regions) return;

    showLoading(true);
    try {
        // Check cache first
        let data;
        if (dataCache['regions_full']) {
            data = dataCache['regions_full'];
        } else {
            const response = await fetch('/api/maps/regions');
            data = await response.json();
            dataCache['regions_full'] = data;
        }

        if (data.success && data.regions) {
            displayRegions(data.regions);
            // Keep citystates visible at regional level
            if (!layers.citystates && dataCache['citystates']) {
                displayCitystates();
            }
        }
    } catch (error) {
        console.error('Error loading regions:', error);
    } finally {
        showLoading(false);
    }
}

async function displayRegions(regions) {
    if (!layerVisibility.regions) return;

    if (layers.regions) {
        map.removeLayer(layers.regions);
    }

    const regionLayer = L.layerGroup();

    // Load full regional boundary data for each region
    for (const region of regions) {
        try {
            // Fetch detailed region data with boundaries
            // Use region.id from API response, not transformed name
            const regionId = region.id || region.name.toLowerCase().replace(/\s+/g, '-');
            const response = await fetch(`/api/maps/regions/${regionId}`);
            const regionDetail = await response.json();

            // API returns GeoJSON FeatureCollection with features object containing region, citystates, villages
            if (regionDetail.features && regionDetail.features.region) {
                // Draw region boundary polygon
                L.geoJSON(regionDetail.features.region, {
                    style: {
                        color: COLORS.region,
                        weight: 3,
                        fillColor: COLORS.region,
                        fillOpacity: 0.1,
                        dashArray: '10, 10'
                    },
                    onEachFeature: (feature, layer) => {
                        layer.bindPopup(`
                            <div class="map-popup">
                                <strong>${region.name}</strong><br>
                                <div style="margin-top:8px;">
                                    Cities: ${region.cityCount || 0}<br>
                                    Population: ${(region.population || 0).toLocaleString()}<br>
                                    Culture: ${region.primaryCulture || 'Mixed'}<br>
                                    Religion: ${region.primaryReligion || 'Various'}
                                </div>
                                <div class="popup-buttons">
                                    <button onclick="zoomToRegion('${region.name}', ${region.centroid[1]}, ${region.centroid[0]})">Explore Region</button>
                                </div>
                            </div>
                        `);
                    }
                }).addTo(regionLayer);
            }
        } catch (error) {
            console.warn(`Could not load boundary for region ${region.name}:`, error);
            // Fallback to marker if boundary fails
            const marker = L.circleMarker([region.centroid[1], region.centroid[0]], {
                radius: 12,
                fillColor: COLORS.region,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.7,
                className: 'region-marker'
            });

            marker.bindPopup(`
                <div class="map-popup">
                    <strong>${region.name}</strong><br>
                    <div style="margin-top:8px;">
                        Cities: ${region.cityCount || 0}<br>
                        Population: ${(region.population || 0).toLocaleString()}
                    </div>
                </div>
            `);

            marker.addTo(regionLayer);
        }
    }

    layers.regions = regionLayer.addTo(map);
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = '<span class="breadcrumb-item" onclick="goToWorld()">World</span>';

    // Add region if present
    if (currentContext.regionName) {
        breadcrumb.innerHTML += '<span class="breadcrumb-separator">›</span>';
        breadcrumb.innerHTML += `<span class="breadcrumb-item" onclick="zoomToRegion('${currentContext.regionName}', ${currentContext.lat}, ${currentContext.lon})">${currentContext.regionName}</span>`;
    }

    // Add citystate if present
    if (currentContext.cityName) {
        breadcrumb.innerHTML += '<span class="breadcrumb-separator">›</span>';
        breadcrumb.innerHTML += `<span class="breadcrumb-item" onclick="goToCitystate('${currentContext.cityName}')">${currentContext.cityName}</span>`;
    }

    // Add district if present
    if (currentContext.districtName) {
        breadcrumb.innerHTML += '<span class="breadcrumb-separator">›</span>';
        breadcrumb.innerHTML += `<span class="breadcrumb-item" onclick="goToDistrict('${currentContext.cityName}', '${currentContext.districtName}')">${currentContext.districtName}</span>`;
    }

    // Add building if present
    if (currentContext.buildingId) {
        breadcrumb.innerHTML += '<span class="breadcrumb-separator">›</span>';
        breadcrumb.innerHTML += `<span class="breadcrumb-item active">Building</span>`;
    }
}

function goToWorld() {
    currentContext = { level: 'world' };
    map.setView([0, 0], 3);
    hideAllLayers();
    displayCitystates();
    updateBreadcrumb();
    closeInfoPanel();
}

function goToCitystate(cityName) {
    const city = currentContext;
    if (city.lat && city.lon) {
        zoomToCitystate(cityName, city.lat, city.lon);
    }
}

function goToDistrict(cityName, districtName) {
    showDistrictDetails(cityName, districtName);
}

function showCitystateInfo(city) {
    document.getElementById('infoTitle').textContent = city.name;
    document.getElementById('infoSubtitle').textContent = 'Citystate';
    document.getElementById('infoContent').innerHTML = `
        <div class="info-section">
            <h4>General Information</h4>
            <div class="info-item">
                <span class="info-label">Population</span>
                <span class="info-value">${city.population.toLocaleString()}</span>
            </div>
        </div>
    `;
    document.getElementById('infoPanel').classList.add('visible');
}

function showDistrictInfo(data) {
    document.getElementById('infoTitle').textContent = data.districtName;
    document.getElementById('infoSubtitle').textContent = `District in ${data.cityName}`;
    document.getElementById('infoContent').innerHTML = `
        <div class="info-section">
            <h4>District Information</h4>
            <div class="info-item">
                <span class="info-label">Type</span>
                <span class="info-value">${data.metadata.districtType}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Era</span>
                <span class="info-value">${data.metadata.era}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Buildings</span>
                <span class="info-value">${data.metadata.buildingCount}</span>
            </div>
        </div>
        <div class="info-section">
            <h4>Building Types</h4>
            ${Object.entries(data.metadata.buildingTypes).map(([type, count]) => `
                <div class="info-item">
                    <span class="info-label">${type}</span>
                    <span class="info-value">${count}</span>
                </div>
            `).join('')}
        </div>
    `;
    document.getElementById('infoPanel').classList.add('visible');
}

function showBuildingInfo(data) {
    document.getElementById('infoTitle').textContent = data.properties.specific_type;
    document.getElementById('infoSubtitle').textContent = `${data.properties.type} in ${data.cityName}`;
    document.getElementById('infoContent').innerHTML = `
        <div class="info-section">
            <h4>Building Information</h4>
            <div class="info-item">
                <span class="info-label">Type</span>
                <span class="info-value">${data.properties.type}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Floors</span>
                <span class="info-value">${data.properties.floors}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Age</span>
                <span class="info-value">${data.properties.age} years</span>
            </div>
            <div class="info-item">
                <span class="info-label">Generation</span>
                <span class="info-value">${data.properties.generation}</span>
            </div>
            ${data.properties.hasSubterrain ? '<div class="info-item"><span class="info-label">Basement</span><span class="info-value">Yes</span></div>' : ''}
        </div>
    `;
    document.getElementById('infoPanel').classList.add('visible');
}

function closeInfoPanel() {
    document.getElementById('infoPanel').classList.remove('visible');
}

function updateLegend() {
    const legend = document.getElementById('legend');
    let html = '<h4>Legend</h4>';

    if (currentLevel === 'world' || currentLevel === 'region') {
        html += `
            <div class="legend-item">
                <div class="legend-color" style="background: ${COLORS.citystate}"></div>
                <span>Citystate</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${COLORS.region}"></div>
                <span>Region</span>
            </div>
        `;
    } else if (currentLevel === 'citystate' || currentLevel === 'district') {
        html += `
            <div class="legend-item">
                <div class="legend-color" style="background: ${COLORS.district}"></div>
                <span>District</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${COLORS.building_residential}"></div>
                <span>Residential</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${COLORS.building_commercial}"></div>
                <span>Commercial</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${COLORS.building_other}"></div>
                <span>Other</span>
            </div>
        `;
    } else if (currentLevel === 'building') {
        html += `
            <div class="legend-item">
                <div class="legend-color" style="background: ${COLORS.room}"></div>
                <span>Room</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #e74c3c; border-radius: 50%"></div>
                <span>Stairs</span>
            </div>
        `;
    }

    legend.innerHTML = html;
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('visible', show);
    document.getElementById('map').classList.toggle('loading', show);
}

function showInfoPanel(html) {
    const panel = document.getElementById('infoPanel');
    const content = document.getElementById('infoContent');
    if (!content) {
        console.error('Info panel content element not found');
        return;
    }
    content.innerHTML = html;
    panel.classList.add('visible');
}

async function viewCitystateWiki(cityId, cityName) {
    try {
        const response = await fetch(`/api/wiki/location/citystate/${cityId}`);
        const data = await response.json();

        if (data.success && data.entries.length > 0) {
            // Show wiki entries in info panel
            let html = `<h3>📖 Wiki: ${cityName}</h3>`;
            data.entries.forEach(entry => {
                html += `
                    <div class="wiki-entry">
                        <h4><a href="/wiki_dynamic.html?id=${entry.id}" target="_blank">${entry.title}</a></h4>
                        <p>${entry.excerpt || ''}</p>
                        <small>Category: ${entry.category}</small>
                    </div>
                `;
            });
            showInfoPanel(html);
        } else {
            // No wiki entries, offer to create one
            showInfoPanel(`
                <h3>📖 Wiki: ${cityName}</h3>
                <p>No wiki entries yet for this location.</p>
                <a href="/wiki_dynamic.html?create=1&location_type=citystate&location_id=${cityId}&location_name=${cityName}"
                   target="_blank"
                   class="button">Create Wiki Entry</a>
            `);
        }
    } catch (error) {
        console.error('Error loading wiki data:', error);
        showInfoPanel(`
            <h3>📖 Wiki: ${cityName}</h3>
            <p>Error loading wiki data.</p>
        `);
    }
}

function startGameHere(latitude, longitude, locationType, locationId) {
    const gameFormData = {
        latitude: latitude,
        longitude: longitude,
        location_type: locationType,
        location_id: locationId
    };

    // Store in localStorage for the game creation form
    localStorage.setItem('gameLocationData', JSON.stringify(gameFormData));

    // Open game creation form in new tab
    window.open('/hml/create-game.html', '_blank');
}

function joinGame(gameId) {
    window.location.href = `/hml/my-games.html?gameId=${gameId}`;
}

function viewGame(gameId) {
    window.location.href = `/hml/my-games.html?gameId=${gameId}`;
}

async function displayWikiMarkers() {
    if (!layerVisibility.wiki) {
        if (layers.wiki) {
            map.removeLayer(layers.wiki);
        }
        return;
    }

    try {
        const response = await fetch('/api/wiki/entries');
        const entries = await response.json();

        if (!entries.success || !entries.entries) {
            console.warn('No wiki data available');
            return;
        }

        if (layers.wiki) {
            map.removeLayer(layers.wiki);
        }

        const wikiLayer = L.layerGroup();

        entries.entries.forEach(entry => {
            if (!entry.latitude || !entry.longitude) return;

            const marker = L.marker([entry.latitude, entry.longitude], {
                icon: L.divIcon({
                    className: 'wiki-marker',
                    html: '<div class="wiki-icon">📖</div>',
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            });

            marker.bindPopup(`
                <div class="map-popup wiki-popup">
                    <div class="popup-header">
                        <strong>📖 ${entry.title}</strong>
                        <span class="wiki-category-badge">${entry.category || 'General'}</span>
                    </div>
                    <div class="popup-content">
                        <p>${entry.excerpt || entry.content.substring(0, 150) + '...' || 'No excerpt available'}</p>
                        <div style="margin-top:8px;">
                            <strong>Category:</strong> ${entry.category || 'General'}<br>
                            <strong>Last Updated:</strong> ${new Date(entry.updated_at).toLocaleDateString()}
                        </div>
                    </div>
                    <div class="popup-buttons">
                        <button onclick="viewWikiEntry('${entry.id}')">View Wiki Entry</button>
                        <button onclick="editWikiEntry('${entry.id}')">Edit Entry</button>
                    </div>
                </div>
            `);

            wikiLayer.addLayer(marker);
        });

        layers.wiki = wikiLayer.addTo(map);

    } catch (error) {
        console.error('Error loading wiki markers:', error);
    }
}

function viewWikiEntry(entryId) {
    window.location.href = `/hml/wiki.html?entry=${entryId}`;
}

function editWikiEntry(entryId) {
    window.location.href = `/hml/wiki-editor.html?entry=${entryId}`;
}

function createWikiEntry() {
    const center = map.getCenter();
    const wikiEditorUrl = `/hml/wiki-editor.html?lat=${center.lat}&lon=${center.lng}&zoom=${currentZoom}`;

    fetch(wikiEditorUrl, { method: 'HEAD' }).then(response => {
        if (response.ok) {
            window.location.href = wikiEditorUrl;
        } else {
            alert('Wiki editor is not yet available. This feature is coming soon!');
        }
    }).catch(() => {
        alert('Wiki editor is not yet available. This feature is coming soon!');
    });
}

function viewEconomics() {
    const economicsUrl = '/hml/economics.html';

    fetch(economicsUrl, { method: 'HEAD' }).then(response => {
        if (response.ok) {
            window.open(economicsUrl, '_blank');
        } else {
            alert('Economics dashboard is not yet available. This feature is coming soon!');
        }
    }).catch(() => {
        alert('Economics dashboard is not yet available. This feature is coming soon!');
    });
}

function filterGamesByStatus(showActive, showRecruiting, showArchived) {
    gameFilters.showActive = showActive;
    gameFilters.showRecruiting = showRecruiting;
    gameFilters.showArchived = showArchived;
    displayGames();
}

function shareLocation() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const url = `${window.location.origin}${window.location.pathname}?lat=${center.lat.toFixed(6)}&lon=${center.lng.toFixed(6)}&zoom=${zoom}`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            alert('Location link copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            prompt('Copy this link:', url);
        });
    } else {
        prompt('Copy this link:', url);
    }
}

async function buildIntegratedSearchIndex() {
    try {
        const [citiesData, gamesData, wikiData] = await Promise.all([
            safeApiCall('/api/citystates').then(data => data || { citystates: [] }), // Use /api/citystates, not /api/maps/citystates
            safeApiCall('/api/maps/games').then(data => data || { games: [] }),
            safeApiCall('/api/wiki/entries').then(data => data || { entries: [] })
        ]);

        searchIndex = [];

        if (citiesData.citystates) {
            citiesData.citystates.forEach(city => {
                if (city.name && city.center) {
                    searchIndex.push({
                        type: 'citystate',
                        name: city.display_name || city.name,
                        subtitle: `${city.building_count || 0} buildings`,
                        icon: '🏙️',
                        coordinates: [city.center.lat, city.center.lng],
                        zoom: 10,
                        data: city
                    });
                }
            });
        }

        if (gamesData.games) {
            gamesData.games.forEach(game => {
                if (game.name && game.latitude && game.longitude) {
                    searchIndex.push({
                        type: 'game',
                        name: game.name,
                        subtitle: `${game.player_count || 0} players · ${game.genre || 'General'}`,
                        icon: '🎮',
                        coordinates: [game.latitude, game.longitude],
                        zoom: 12,
                        data: game
                    });
                }
            });
        }

        if (wikiData.entries) {
            wikiData.entries.forEach(entry => {
                if (entry.title && entry.latitude && entry.longitude) {
                    searchIndex.push({
                        type: 'wiki',
                        name: entry.title,
                        subtitle: entry.category || 'General',
                        icon: '📖',
                        coordinates: [entry.latitude, entry.longitude],
                        zoom: 14,
                        data: entry
                    });
                }
            });
        }

        console.log(`Search index built: ${searchIndex.length} items`);
    } catch (error) {
        console.error('Error building integrated search index:', error);
    }
}

async function fetchWithDeduplication(url) {
    if (pendingRequests.has(url)) {
        return pendingRequests.get(url);
    }

    const promise = fetch(url).then(r => r.json()).finally(() => {
        pendingRequests.delete(url);
    });

    pendingRequests.set(url, promise);
    return promise;
}

async function safeApiCall(url, options = {}) {
    const maxRetries = 2;
    const retryDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetchWithDeduplication(url);
            return response;
        } catch (error) {
            console.error(`API call failed (attempt ${i + 1}/${maxRetries}):`, error);

            if (i === maxRetries - 1) {
                console.error(`Failed to load data from ${url}: ${error.message}`);
                return null;
            }

            await new Promise(resolve => setTimeout(resolve, retryDelay * (i + 1)));
        }
    }
}

function loadURLState() {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat'));
    const lon = parseFloat(params.get('lon'));
    const zoom = parseInt(params.get('zoom'));

    // Check for wiki entry parameters
    const wikiEntry = params.get('wiki_entry');
    const wikiTitle = params.get('title');
    const cycle = params.get('cycle');
    const day = params.get('day');
    const locationType = params.get('location_type');
    const locationId = params.get('location_id');

    // Store wiki context for later use (e.g., highlighting)
    if (wikiEntry) {
        window.wikiContext = {
            entryId: wikiEntry,
            title: decodeURIComponent(wikiTitle || ''),
            cycle: cycle ? parseInt(cycle) : null,
            day: day ? parseInt(day) : null,
            locationType: locationType,
            locationId: locationId
        };

        // Add wiki breadcrumb navigation
        addWikiBreadcrumb(window.wikiContext.title);

        // If temporal parameters provided, update temporal controls
        if (cycle !== null && temporalControls) {
            temporalControls.setCycle(parseInt(cycle));
            if (day !== null) {
                temporalControls.setDay(parseInt(day));
            }
        }
    }

    if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) {
        map.setView([lat, lon], zoom);
        currentZoom = zoom;

        // If this is a wiki entry, highlight it after markers load
        if (wikiEntry) {
            setTimeout(() => {
                highlightWikiLocation(lat, lon, locationType, locationId);
            }, 1000);
        }

        return true;
    }
    return false;
}

function updateURLState() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const url = new URL(window.location);

    url.searchParams.set('lat', center.lat.toFixed(6));
    url.searchParams.set('lon', center.lng.toFixed(6));
    url.searchParams.set('zoom', zoom);

    window.history.replaceState({}, '', url);
}

function debounceURLUpdate() {
    if (urlUpdateTimer) {
        clearTimeout(urlUpdateTimer);
    }

    urlUpdateTimer = setTimeout(() => {
        updateURLState();
    }, URL_UPDATE_DELAY);
}

function addWikiBreadcrumb(wikiTitle) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;

    const wikiLink = document.createElement('span');
    wikiLink.className = 'breadcrumb-item wiki-breadcrumb';
    wikiLink.innerHTML = `📖 Wiki: ${wikiTitle}`;
    wikiLink.style.color = '#667eea';
    wikiLink.style.cursor = 'pointer';
    wikiLink.title = 'Return to wiki entry';

    wikiLink.addEventListener('click', () => {
        if (window.wikiContext && window.wikiContext.entryId) {
            window.location.href = `/hml/wiki_dynamic_production.html?entry=${window.wikiContext.entryId}`;
        }
    });

    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.textContent = '›';

    breadcrumb.insertBefore(separator, breadcrumb.firstChild);
    breadcrumb.insertBefore(wikiLink, breadcrumb.firstChild);
}

function highlightWikiLocation(lat, lon, locationType, locationId) {
    const highlightMarker = L.circleMarker([lat, lon], {
        radius: 20,
        fillColor: '#667eea',
        color: '#764ba2',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.3,
        className: 'wiki-highlight-marker'
    }).addTo(map);

    highlightMarker.bindPopup(`
        <div style="text-align: center;">
            <strong>📖 Wiki Entry Location</strong><br>
            ${window.wikiContext ? window.wikiContext.title : 'Wiki Location'}
        </div>
    `).openPopup();

    const pulseAnimation = setInterval(() => {
        const currentRadius = highlightMarker.getRadius();
        highlightMarker.setRadius(currentRadius === 20 ? 25 : 20);
    }, 500);

    highlightMarker.on('remove', () => {
        clearInterval(pulseAnimation);
    });

    window.wikiHighlightMarker = highlightMarker;
}

function initKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeInfoPanel();
            document.getElementById('searchResults').classList.remove('visible');
            const floorSelector = document.getElementById('floorSelector');
            if (floorSelector) {
                floorSelector.classList.remove('visible');
            }
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            document.getElementById('mapSearch').focus();
        }

        if (e.key.startsWith('Arrow') && !e.target.matches('input, textarea')) {
            e.preventDefault();
            const panAmount = 50;
            const directions = {
                'ArrowUp': [0, -panAmount],
                'ArrowDown': [0, panAmount],
                'ArrowLeft': [-panAmount, 0],
                'ArrowRight': [panAmount, 0]
            };
            map.panBy(directions[e.key]);
        }

        if ((e.key === '+' || e.key === '=') && !e.target.matches('input, textarea')) {
            map.zoomIn();
        } else if ((e.key === '-' || e.key === '_') && !e.target.matches('input, textarea')) {
            map.zoomOut();
        }
    });
}

function initAccessibility() {
    document.querySelectorAll('.layer-controls input[type="checkbox"]').forEach(checkbox => {
        const label = checkbox.parentElement.textContent.trim();
        checkbox.setAttribute('aria-label', `Toggle ${label} layer`);
    });

    const search = document.getElementById('mapSearch');
    if (search) {
        search.setAttribute('role', 'searchbox');
        search.setAttribute('aria-label', 'Search locations, games, and wiki entries');
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        document.documentElement.classList.add('reduce-motion');
    }
}

window.addEventListener('DOMContentLoaded', initMap);
window.zoomToCitystate = zoomToCitystate;
window.showDistrictDetails = showDistrictDetails;
window.showBuildingDetails = showBuildingDetails;
window.closeInfoPanel = closeInfoPanel;
window.goToWorld = goToWorld;
window.goToCitystate = goToCitystate;
window.goToDistrict = goToDistrict;
window.viewCitystateWiki = viewCitystateWiki;
window.startGameHere = startGameHere;
window.joinGame = joinGame;
window.viewGame = viewGame;
window.jumpToLocation = jumpToLocation;
window.zoomToRegion = zoomToRegion;
window.viewWikiEntry = viewWikiEntry;
window.editWikiEntry = editWikiEntry;
window.createWikiEntry = createWikiEntry;
window.viewEconomics = viewEconomics;
window.filterGamesByStatus = filterGamesByStatus;
window.shareLocation = shareLocation;
window.displayWikiMarkers = displayWikiMarkers;