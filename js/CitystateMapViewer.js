/**
 * CitystateMapViewer - Local detailed map system for citystates
 * Integrates with existing Leaflet global map system
 */

class CitystateMapViewer {
    constructor(mapElementId, options = {}) {
        this.mapElementId = mapElementId;
        this.map = null;
        this.currentCitystate = null;
        this.layers = {
            baseMap: null,
            buildings: null,
            districts: null,
            castles: null,
            towers: null,
            walls: null,
            fields: null,
            trees: null,
            roads: null
        };
        this.layerGroups = {};
        this.citystates = [];
        this.citystateLocations = []; // For click detection
        this.isLocalMode = false;
        this.clickPopup = null; // For managing click popups
        this.miniMap = null; // For global context minimap
        this.miniMapMarker = null; // Marker showing current citystate location

        // Configuration
        this.config = {
            globalTileUrl: 'https://rhovasti.github.io/eno-tiles/{z}/{x}/{y}.png',
            globalCenter: [1.37, 10.94],
            globalZoom: 6,
            apiBaseUrl: '/api/citystates',
            staticBaseUrl: '/static/maps/citystates',
            // GitHub CDN configuration
            useGitHubCDN: false, // Set to true to enable GitHub CDN
            githubCDN: {
                apiBaseUrl: 'https://rhovasti.github.io/eno-citystate-maps/api',
                staticBaseUrl: 'https://rhovasti.github.io/eno-citystate-maps/citystates'
            },
            ...options
        };

        this.init();
    }

    async init() {
        console.log('Initializing CitystateMapViewer...');

        // Initialize map
        this.setupMap();

        // Load available citystates first
        await this.loadCitystates();

        // Setup UI controls after citystates are loaded
        this.setupControls();

        console.log('CitystateMapViewer initialized successfully');
    }

    setupMap() {
        // Initialize map with global view
        this.map = L.map(this.mapElementId).setView(this.config.globalCenter, this.config.globalZoom);

        // Add global tile layer
        this.layers.baseMap = L.tileLayer(this.config.globalTileUrl, {
            attribution: 'Eno World Map - Custom satellite imagery',
            minZoom: 0,
            maxZoom: 8,
            opacity: 0.8,
            tms: true  // Important: tiles are in TMS format
        }).addTo(this.map);

        // Add click handler for global map interactions
        this.map.on('click', (e) => {
            this.handleMapClick(e);
        });

        // Initialize layer groups
        Object.keys(this.layers).forEach(layerType => {
            if (layerType !== 'baseMap') {
                this.layerGroups[layerType] = L.layerGroup();
            }
        });

        console.log('Map initialized with global tiles');
    }

    async loadCitystates() {
        try {
            const apiUrl = this.getApiUrl();
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.success || data.citystates) {
                this.citystates = data.citystates || [];
                console.log(`Loaded ${this.citystates.length} citystates`);

                // Repopulate dropdown if it exists
                if (document.getElementById('citystate-select')) {
                    this.populateCitystateSelector();
                }

                return this.citystates;
            } else {
                console.error('Failed to load citystates:', data.error);
                return [];
            }
        } catch (error) {
            console.error('Error loading citystates:', error);
            return [];
        }
    }

    // GitHub CDN helper methods
    getApiUrl() {
        if (this.config.useGitHubCDN) {
            return `${this.config.githubCDN.apiBaseUrl}/citystates.json`;
        }
        return this.config.apiBaseUrl;
    }

    getStaticUrl(citystateName, fileName) {
        if (this.config.useGitHubCDN) {
            return `${this.config.githubCDN.staticBaseUrl}/${citystateName}/${fileName}`;
        }
        return `${this.config.staticBaseUrl}/${citystateName}/${fileName}`;
    }

    getCitystateConfigUrl(citystateName) {
        if (this.config.useGitHubCDN) {
            // GitHub CDN: Direct access to static config file
            return `${this.config.githubCDN.staticBaseUrl}/${citystateName}/config.json`;
        }
        // Local server: Use API endpoint that wraps response with success flag
        return `${this.config.apiBaseUrl}/${citystateName}/config`;
    }

    // Method to enable/disable GitHub CDN
    enableGitHubCDN(enable = true) {
        this.config.useGitHubCDN = enable;
        console.log(`GitHub CDN ${enable ? 'enabled' : 'disabled'}`);

        // Reload citystates if CDN setting changed
        if (this.citystates.length === 0) {
            this.loadCitystates();
        }
    }

    // Populate the citystate dropdown selector
    populateCitystateSelector() {
        const selectElement = document.getElementById('citystate-select');
        if (!selectElement) {
            console.warn('Citystate selector element not found');
            return;
        }

        // Clear existing options except the first one
        while (selectElement.children.length > 1) {
            selectElement.removeChild(selectElement.lastChild);
        }

        // Add citystate options
        this.citystates.forEach(citystate => {
            const option = document.createElement('option');
            option.value = citystate.name || citystate;
            option.textContent = (typeof citystate === 'object' ? citystate.display_name || citystate.name : citystate) || citystate;
            selectElement.appendChild(option);
        });

        console.log(`Populated citystate selector with ${this.citystates.length} citystates`);
    }

    setupControls() {
        // Check if we're in wiki integration mode (existing map-controls present)
        const existingControls = document.querySelector('.map-controls');

        if (existingControls) {
            // Wiki integration mode - add our controls to existing structure
            this.setupWikiIntegratedControls(existingControls);
        } else {
            // Standalone mode - create our own controls
            this.setupStandaloneControls();
        }

        // Populate citystate selector
        this.populateCitystateSelector();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupWikiIntegratedControls(controlsContainer) {
        // Add mode selection buttons to the existing controls
        const modeControls = document.createElement('div');
        modeControls.innerHTML = `
            <h4>Map Mode</h4>
            <div style="margin-bottom: 15px;">
                <button id="global-mode-btn" class="mode-btn active" style="margin-right: 10px; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; background: #8b7355; color: white;">Global View</button>
                <button id="local-mode-btn" class="mode-btn" style="padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; background: #f4e8d0;">Local View</button>
            </div>
            <div class="citystate-selector" id="citystate-selector" style="display: none; margin-bottom: 15px;">
                <label for="citystate-select" style="display: block; font-weight: bold; margin-bottom: 5px;">Select Citystate:</label>
                <select id="citystate-select" style="width: 100%; padding: 5px; border-radius: 4px; border: 1px solid #8b7355;">
                    <option value="">Select a Citystate...</option>
                </select>
            </div>
        `;

        // Insert the mode controls at the beginning of existing controls
        controlsContainer.insertBefore(modeControls, controlsContainer.firstChild);

        console.log('Integrated citystate controls into existing wiki map controls');
    }

    setupStandaloneControls() {
        // Create control container
        const controlContainer = document.createElement('div');
        controlContainer.className = 'citystate-controls';
        controlContainer.innerHTML = `
            <div class="map-mode-controls">
                <button id="global-mode-btn" class="mode-btn active">Global View</button>
                <button id="local-mode-btn" class="mode-btn">Local View</button>
            </div>
            <div class="citystate-selector" id="citystate-selector" style="display: none;">
                <select id="citystate-select">
                    <option value="">Select a Citystate...</option>
                </select>
            </div>
            <div class="background-controls" id="background-controls" style="display: none;">
                <h4>Background</h4>
                <select id="texture-select">
                    <option value="raster">Original Map</option>
                    <option value="temperate" selected>Temperate</option>
                    <option value="grasslands">Grasslands</option>
                    <option value="arid">Arid Shrublands</option>
                </select>
            </div>
            <div class="layer-controls" id="layer-controls" style="display: none;">
                <h4>Vector Layers</h4>
                <div class="layer-toggle">
                    <label><input type="checkbox" id="buildings-toggle" checked> Buildings</label>
                </div>
                <div class="layer-toggle">
                    <label><input type="checkbox" id="districts-toggle" checked> Districts</label>
                </div>
                <div class="layer-toggle">
                    <label><input type="checkbox" id="castles-toggle" checked> Castles</label>
                </div>
                <div class="layer-toggle">
                    <label><input type="checkbox" id="towers-toggle" checked> Towers</label>
                </div>
                <div class="layer-toggle">
                    <label><input type="checkbox" id="walls-toggle" checked> Walls</label>
                </div>
                <div class="layer-toggle">
                    <label><input type="checkbox" id="fields-toggle" checked> Fields</label>
                </div>
                <div class="layer-toggle">
                    <label><input type="checkbox" id="trees-toggle" checked> Trees</label>
                </div>
                <div class="layer-toggle">
                    <label><input type="checkbox" id="roads-toggle" checked> Roads</label>
                </div>
            </div>
            <div class="citystate-info" id="citystate-info" style="display: none;">
                <h4 id="citystate-name"></h4>
                <div id="citystate-stats"></div>
            </div>
        `;

        // Add to page
        document.body.appendChild(controlContainer);

        console.log('Created standalone citystate controls');
    }

    setupEventListeners() {
        // Mode switching
        const globalBtn = document.getElementById('global-mode-btn');
        const localBtn = document.getElementById('local-mode-btn');

        if (globalBtn) {
            globalBtn.addEventListener('click', () => {
                this.switchToGlobalMode();
            });
        }

        if (localBtn) {
            localBtn.addEventListener('click', () => {
                this.switchToLocalMode();
            });
        }

        // Citystate selection
        const citystateSelect = document.getElementById('citystate-select');
        if (citystateSelect) {
            citystateSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadCitystate(e.target.value);
                }
            });
        }

        // Texture background selection
        const textureSelect = document.getElementById('texture-select');
        if (textureSelect) {
            textureSelect.addEventListener('change', (e) => {
                if (this.currentCitystate) {
                    this.updateBackground(e.target.value);
                }
            });
        }

        // Layer toggles
        ['buildings', 'districts', 'castles', 'towers', 'walls', 'fields', 'trees', 'roads'].forEach(layerType => {
            const toggle = document.getElementById(`${layerType}-toggle`);
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    this.toggleLayer(layerType, e.target.checked);
                });
            }
        });
    }

    switchToGlobalMode() {
        this.isLocalMode = false;

        // Update UI - handle both wiki-integrated and standalone styling
        const globalBtn = document.getElementById('global-mode-btn');
        const localBtn = document.getElementById('local-mode-btn');

        if (globalBtn && localBtn) {
            // Handle both CSS classes and inline styles
            globalBtn.classList.add('active');
            localBtn.classList.remove('active');

            // Wiki-integrated style updates
            if (globalBtn.style.backgroundColor) {
                globalBtn.style.backgroundColor = '#8b7355';
                globalBtn.style.color = 'white';
                localBtn.style.backgroundColor = '#f4e8d0';
                localBtn.style.color = 'black';
            }
        }

        document.getElementById('citystate-selector').style.display = 'none';

        // Hide standalone controls if they exist
        const bgControls = document.getElementById('background-controls');
        const layerControls = document.getElementById('layer-controls');
        const citystateInfo = document.getElementById('citystate-info');
        if (bgControls) bgControls.style.display = 'none';
        if (layerControls) layerControls.style.display = 'none';
        if (citystateInfo) citystateInfo.style.display = 'none';

        // Clear local layers
        this.clearLocalLayers();

        // Reset to global view
        this.map.removeLayer(this.layers.baseMap);
        this.layers.baseMap = L.tileLayer(this.config.globalTileUrl, {
            attribution: 'Eno World Map - Custom satellite imagery',
            minZoom: 0,
            maxZoom: 8,
            opacity: 0.8,
            tms: true  // Important: tiles are in TMS format
        }).addTo(this.map);

        this.map.setView(this.config.globalCenter, this.config.globalZoom);

        // Remove minimap when in global mode
        this.destroyMiniMap();

        console.log('Switched to global mode');
    }

    switchToLocalMode() {
        this.isLocalMode = true;

        // Update UI - handle both wiki-integrated and standalone styling
        const globalBtn = document.getElementById('global-mode-btn');
        const localBtn = document.getElementById('local-mode-btn');

        if (globalBtn && localBtn) {
            // Handle both CSS classes and inline styles
            globalBtn.classList.remove('active');
            localBtn.classList.add('active');

            // Wiki-integrated style updates
            if (globalBtn.style.backgroundColor) {
                globalBtn.style.backgroundColor = '#f4e8d0';
                globalBtn.style.color = 'black';
                localBtn.style.backgroundColor = '#8b7355';
                localBtn.style.color = 'white';
            }
        }

        document.getElementById('citystate-selector').style.display = 'block';

        console.log('Switched to local mode');
    }

    // Alias for wiki integration compatibility
    async switchToCitystate(citystateName) {
        return this.loadCitystate(citystateName);
    }

    async loadCitystate(citystateName) {
        try {
            console.log(`Loading citystate: ${citystateName}`);

            // Load configuration using the appropriate URL (local or CDN)
            const configUrl = this.getCitystateConfigUrl(citystateName);
            const configResponse = await fetch(configUrl);
            let configData;

            if (this.config.useGitHubCDN) {
                // GitHub CDN returns direct JSON config
                configData = await configResponse.json();
            } else {
                // Local server returns wrapped response
                if (!configResponse.ok) {
                    throw new Error(`HTTP ${configResponse.status}: ${configResponse.statusText}`);
                }
                const response = await configResponse.json();
                if (!response.success) {
                    throw new Error(response.error || `Failed to load citystate configuration: ${citystateName}`);
                }
                // Extract the actual config data from the response wrapper
                configData = {
                    citystate: response.citystate,
                    display_name: response.display_name,
                    bounds: response.bounds,
                    center: response.center,
                    castle_position: response.castle_position,
                    zoom_levels: response.zoom_levels,
                    statistics: response.statistics,
                    features: response.features
                };
            }

            this.currentCitystate = {
                name: citystateName,
                config: configData
            };

            // Clear existing local layers
            this.clearLocalLayers();

            // Setup local base map
            await this.setupLocalBaseMap(citystateName, configData);

            // Load vector layers
            await this.loadVectorLayers(citystateName);

            // Set map view to citystate bounds
            const bounds = configData.bounds;
            this.map.fitBounds([
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
            ]);

            // Show controls and info (if they exist)
            const backgroundControls = document.getElementById('background-controls');
            const layerControls = document.getElementById('layer-controls');
            const citystateInfo = document.getElementById('citystate-info');

            if (backgroundControls) backgroundControls.style.display = 'block';
            if (layerControls) layerControls.style.display = 'block';
            if (citystateInfo) citystateInfo.style.display = 'block';

            // Update info panel
            this.updateInfoPanel(configData);

            // Create minimap and update marker for global context
            this.createMiniMap();
            if (configData.center) {
                this.updateMiniMapMarker(
                    configData.center.lat,
                    configData.center.lng,
                    configData.display_name || citystateName
                );
            }

            console.log(`Successfully loaded citystate: ${citystateName}`);

        } catch (error) {
            console.error(`Error loading citystate ${citystateName}:`, error);
            alert(`Failed to load citystate: ${error.message}`);
        }
    }

    async setupLocalBaseMap(citystateName, config) {
        // Remove global tiles
        if (this.layers.baseMap) {
            this.map.removeLayer(this.layers.baseMap);
        }

        // Store current config for background updates
        this.currentConfig = config;

        // Get selected texture type, default to temperate
        const textureSelect = document.getElementById('texture-select');
        const textureType = textureSelect ? textureSelect.value : 'temperate';

        this.createBackgroundLayer(citystateName, config, textureType);
        console.log(`Local base map loaded for ${citystateName} with ${textureType} background`);
    }

    createBackgroundLayer(citystateName, config, textureType) {
        if (textureType === 'raster') {
            // Use original raster map
            const bounds = config.bounds;
            const imageBounds = [
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
            ];

            // Use appropriate URL for raster map (CDN uses .webp, local uses .png)
            const imageFileName = this.config.useGitHubCDN ? 'map.webp' : `${citystateName}_map.png`;
            const imageUrl = this.getStaticUrl(citystateName, imageFileName);

            this.layers.baseMap = L.imageOverlay(imageUrl, imageBounds, {
                opacity: 0.8,
                interactive: false
            }).addTo(this.map);
        } else {
            // Use texture background
            this.createTextureBackground(textureType);
        }
    }

    createTextureBackground(textureType) {
        // Map texture types to file names
        const textureFiles = {
            'temperate': 'Temperate 01.png',
            'grasslands': 'Grasslands 01.png',
            'arid': 'Arid Shrublands 01.png'
        };

        const textureFile = textureFiles[textureType] || textureFiles['temperate'];
        const textureUrl = `/static/textures/${textureFile}`;

        // Create a large bounds that covers the entire citystate area
        const bounds = this.currentConfig.bounds;
        const imageBounds = [
            [bounds.south - 0.01, bounds.west - 0.01],
            [bounds.north + 0.01, bounds.east + 0.01]
        ];

        // Create an image overlay with the texture, repeated via CSS
        this.layers.baseMap = L.imageOverlay(textureUrl, imageBounds, {
            opacity: 0.6,
            interactive: false,
            className: 'texture-background'
        }).addTo(this.map);

        // Apply CSS to make the texture repeat
        setTimeout(() => {
            const textureElements = document.querySelectorAll('.texture-background');
            textureElements.forEach(element => {
                element.style.backgroundImage = `url(${textureUrl})`;
                element.style.backgroundRepeat = 'repeat';
                element.style.backgroundSize = '256px 256px';
            });
        }, 100);
    }

    updateBackground(textureType) {
        if (this.layers.baseMap) {
            this.map.removeLayer(this.layers.baseMap);
        }

        if (this.currentCitystate && this.currentConfig) {
            this.createBackgroundLayer(this.currentCitystate, this.currentConfig, textureType);
            console.log(`Background updated to ${textureType}`);
        }
    }

    async loadVectorLayers(citystateName) {
        const layerTypes = ['buildings', 'districts', 'castles', 'towers', 'walls', 'fields', 'trees', 'roads'];

        for (const layerType of layerTypes) {
            try {
                let data;

                if (this.config.useGitHubCDN) {
                    // Load directly from GitHub CDN GeoJSON files
                    const geoJsonUrl = this.getStaticUrl(citystateName, `${layerType}.geojson`);
                    const response = await fetch(geoJsonUrl);
                    data = await response.json();
                } else {
                    // Load from local API
                    const response = await fetch(`${this.config.apiBaseUrl}/${citystateName}/features/${layerType}`);
                    const result = await response.json();
                    // The API returns the GeoJSON data directly in the result with success flag
                    if (result.success) {
                        // Extract just the GeoJSON part (type and features)
                        data = {
                            type: result.type || 'FeatureCollection',
                            features: result.features || []
                        };
                    } else {
                        data = null;
                    }
                }

                if (data && data.features && data.features.length > 0) {
                    // Create layer group if it doesn't exist
                    if (!this.layerGroups[layerType]) {
                        this.layerGroups[layerType] = L.layerGroup();
                    }

                    // Clear existing layer
                    this.layerGroups[layerType].clearLayers();

                    // Add GeoJSON to layer group
                    const geoJsonLayer = L.geoJSON(data, {
                        style: this.getLayerStyle(layerType),
                        onEachFeature: (feature, layer) => {
                            this.setupFeaturePopup(feature, layer, layerType);
                        }
                    });

                    this.layerGroups[layerType].addLayer(geoJsonLayer);

                    // Add to map if toggle is checked, or by default if no toggle exists (wiki mode)
                    const toggle = document.getElementById(`${layerType}-toggle`);
                    if (toggle) {
                        // Standalone mode: respect toggle state
                        if (toggle.checked) {
                            this.layerGroups[layerType].addTo(this.map);
                        }
                    } else {
                        // Wiki integration mode: show all layers by default
                        this.layerGroups[layerType].addTo(this.map);
                    }

                    console.log(`Loaded ${data.features.length} ${layerType} features`);
                }
            } catch (error) {
                console.warn(`Failed to load ${layerType} layer:`, error);
            }
        }
    }

    getLayerStyle(layerType) {
        const styles = {
            buildings: {
                fillColor: '#ff7f0e',
                weight: 1,
                opacity: 1,
                color: '#d62728',
                fillOpacity: 0.7
            },
            districts: {
                fillColor: 'transparent',
                weight: 2,
                opacity: 0.8,
                color: '#1f77b4'
            },
            castles: {
                fillColor: '#8c564b',
                weight: 2,
                opacity: 1,
                color: '#7f7f7f',
                fillOpacity: 0.8
            },
            towers: {
                color: '#17becf',
                weight: 3,
                opacity: 0.8
            },
            walls: {
                color: '#bcbd22',
                weight: 3,
                opacity: 0.8
            },
            fields: {
                fillColor: '#2ca02c',
                weight: 1,
                opacity: 0.6,
                color: '#98df8a',
                fillOpacity: 0.4
            },
            trees: {
                color: '#2ca02c',
                weight: 2,
                opacity: 0.7
            },
            roads: {
                color: '#8B4513',
                weight: 3,
                opacity: 0.8
            }
        };

        return styles[layerType] || {
            color: '#1f77b4',
            weight: 2,
            opacity: 0.7
        };
    }

    setupFeaturePopup(feature, layer, layerType) {
        if (feature.properties) {
            const props = feature.properties;
            let popupContent = `<h4>${layerType.charAt(0).toUpperCase() + layerType.slice(1)}</h4>`;

            // Add relevant properties based on layer type
            if (layerType === 'buildings') {
                popupContent += `
                    <p><strong>Type:</strong> ${props.type || 'Unknown'}</p>
                    <p><strong>Occupants:</strong> ${props.occupants || 'N/A'}</p>
                    <p><strong>Floors:</strong> ${props.floors || 'N/A'}</p>
                `;
            } else if (layerType === 'districts') {
                popupContent += `
                    <p><strong>Name:</strong> ${props.name || 'Unnamed'}</p>
                `;
            } else {
                // Generic property display
                Object.keys(props).forEach(key => {
                    if (key !== 'citystate' && props[key]) {
                        popupContent += `<p><strong>${key}:</strong> ${props[key]}</p>`;
                    }
                });
            }

            layer.bindPopup(popupContent);
        }
    }

    toggleLayer(layerType, visible) {
        if (!this.layerGroups[layerType]) return;

        if (visible) {
            this.layerGroups[layerType].addTo(this.map);
        } else {
            this.map.removeLayer(this.layerGroups[layerType]);
        }

        console.log(`${layerType} layer ${visible ? 'shown' : 'hidden'}`);
    }

    // Method for wiki integration basemap switching
    switchBasemap(basemapType) {
        console.log(`CitystateMapViewer: Basemap switch requested to ${basemapType}`);

        if (this.isLocalMode && this.currentCitystate) {
            // Local mode: update the texture/background
            this.updateBackground(basemapType === 'relief' ? 'temperate' : basemapType);
        } else {
            // Global mode: switch the base tile layer
            if (this.layers.baseMap) {
                this.map.removeLayer(this.layers.baseMap);
            }

            if (basemapType === 'relief') {
                // Try to add relief tiles if available, fallback to satellite
                this.layers.baseMap = L.tileLayer('https://rhovasti.github.io/eno-relief-tiles/{z}/{x}/{y}.png', {
                    attribution: 'Eno Relief Map - Custom topographic tiles',
                    minZoom: 0,
                    maxZoom: 8,
                    opacity: 0.8,
                    tms: true,
                    errorTileUrl: 'https://rhovasti.github.io/eno-tiles/{z}/{x}/{y}.png' // Fallback to satellite
                });
            } else {
                // Default satellite imagery
                this.layers.baseMap = L.tileLayer(this.config.globalTileUrl, {
                    attribution: 'Eno World Map - Custom satellite imagery',
                    minZoom: 0,
                    maxZoom: 8,
                    opacity: 0.8,
                    tms: true
                });
            }

            this.layers.baseMap.addTo(this.map);
            console.log(`Switched global basemap to ${basemapType}`);
        }
    }

    updateInfoPanel(config) {
        // Only update info panel if elements exist (standalone mode)
        const citystateNameElement = document.getElementById('citystate-name');
        const citystateStatsElement = document.getElementById('citystate-stats');

        if (!citystateNameElement || !citystateStatsElement) {
            // In wiki integration mode, these elements don't exist
            return;
        }

        citystateNameElement.textContent = config.display_name || config.citystate;

        let statsHtml = `
            <p><strong>Features:</strong></p>
            <ul>
                <li>Buildings: ${config.features.buildings || 0}</li>
                <li>Districts: ${config.features.districts || 0}</li>
                <li>Castles: ${config.features.castles || 0}</li>
                <li>Towers: ${config.features.towers || 0}</li>
                <li>Walls: ${config.features.walls || 0}</li>
                <li>Fields: ${config.features.fields || 0}</li>
                <li>Trees: ${config.features.trees || 0}</li>
            </ul>
        `;

        if (config.statistics && config.statistics.buildings) {
            const buildingStats = config.statistics.buildings;
            statsHtml += `
                <p><strong>Building Statistics:</strong></p>
                <ul>
                    <li>Total Occupants: ${buildingStats.total_occupants || 0}</li>
                    <li>Avg Occupants: ${(buildingStats.avg_occupants || 0).toFixed(1)}</li>
                    <li>Avg Floors: ${(buildingStats.avg_floors || 0).toFixed(1)}</li>
                </ul>
            `;
        }

        citystateStatsElement.innerHTML = statsHtml;
    }

    clearLocalLayers() {
        Object.values(this.layerGroups).forEach(layerGroup => {
            if (layerGroup && this.map.hasLayer(layerGroup)) {
                this.map.removeLayer(layerGroup);
            }
            if (layerGroup) {
                layerGroup.clearLayers();
            }
        });
    }

    // Public API methods
    getCitystates() {
        return this.citystates;
    }

    getCurrentCitystate() {
        return this.currentCitystate;
    }

    isInLocalMode() {
        return this.isLocalMode;
    }

    // Method to integrate with existing global map markers
    addGlobalMarkers(markers) {
        markers.forEach(marker => {
            // Only add in global mode
            if (!this.isLocalMode) {
                marker.addTo(this.map);
            }
        });
    }

    // Global map interaction methods
    handleMapClick(e) {
        // Only handle clicks in global mode
        if (this.isLocalMode) return;

        const clickedLat = e.latlng.lat;
        const clickedLng = e.latlng.lng;

        console.log(`Map clicked at: ${clickedLat}, ${clickedLng}`);

        // Find nearest citystate
        const nearestCitystate = this.findNearestCitystate(clickedLat, clickedLng);

        if (nearestCitystate && nearestCitystate.distance < 2.0) { // Within ~200km
            this.showCitystatePopup(e.latlng, nearestCitystate);
        } else {
            // Show generic location popup
            this.showLocationPopup(e.latlng, clickedLat, clickedLng);
        }
    }

    findNearestCitystate(lat, lng) {
        if (!this.citystateLocations || this.citystateLocations.length === 0) {
            // Try to build locations from citystates list
            this.buildCitystateLocations();
        }

        let nearest = null;
        let minDistance = Infinity;

        this.citystateLocations.forEach(location => {
            const distance = this.calculateDistance(lat, lng, location.lat, location.lng);
            if (distance < minDistance) {
                minDistance = distance;
                nearest = { ...location, distance: distance };
            }
        });

        return nearest;
    }

    buildCitystateLocations() {
        // For now, create approximate locations for major citystates
        // This should ideally be loaded from the server with actual coordinates
        this.citystateLocations = [
            { name: 'alebuo', display_name: 'Alebuo', lat: 24.53, lng: -20.75 },
            { name: 'pranos', display_name: 'Pranos', lat: 25.12, lng: -19.84 },
            { name: 'zadardelen', display_name: 'Zadardelen', lat: 26.45, lng: -18.23 },
            { name: 'guild', display_name: 'Guild', lat: 23.89, lng: -21.12 },
            { name: 'chingsan', display_name: 'Chingsan', lat: 22.34, lng: -19.56 },
            { name: 'jeong', display_name: 'Jeong', lat: 21.78, lng: -20.91 },
            { name: 'mahyapak', display_name: 'Mahyapak', lat: 24.67, lng: -17.45 },
            { name: 'engar', display_name: 'Engar', lat: 26.78, lng: -19.12 },
            { name: 'avesia', display_name: 'Avesia', lat: 23.45, lng: -18.67 },
            { name: 'palwede', display_name: 'Palwede', lat: 25.89, lng: -20.34 }
        ];

        console.log(`Built ${this.citystateLocations.length} citystate locations for click detection`);
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        // Haversine formula for calculating distance between two points
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                Math.sin(dLng/2) * Math.sin(dLng/2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in kilometers
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    showCitystatePopup(latlng, citystate) {
        // Remove existing popup
        if (this.clickPopup) {
            this.map.removeLayer(this.clickPopup);
        }

        const popupContent = `
            <div style="text-align: center; padding: 5px; min-width: 200px;">
                <h3 style="margin: 0 0 10px 0; color: #8b7355;">${citystate.display_name}</h3>
                <p style="margin: 5px 0; color: #666; font-size: 12px;">
                    Distance: ${citystate.distance.toFixed(1)} km
                </p>
                <div style="margin-top: 10px;">
                    <button onclick="window.citystateViewer?.viewCitystateDetails('${citystate.name}')"
                            style="background: #4a90e2; color: white; border: none; padding: 8px 15px;
                                   border-radius: 5px; cursor: pointer; margin-right: 5px;">
                        🗺️ View Details
                    </button>
                    <button onclick="window.citystateViewer?.closeClickPopup()"
                            style="background: #ccc; color: #333; border: none; padding: 8px 15px;
                                   border-radius: 5px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        `;

        this.clickPopup = L.popup({
            maxWidth: 250,
            closeButton: false
        })
            .setLatLng(latlng)
            .setContent(popupContent)
            .openOn(this.map);

        // Make this instance globally accessible for popup callbacks
        window.citystateViewer = this;
    }

    showLocationPopup(latlng, lat, lng) {
        // Remove existing popup
        if (this.clickPopup) {
            this.map.removeLayer(this.clickPopup);
        }

        const popupContent = `
            <div style="text-align: center; padding: 5px; min-width: 180px;">
                <h3 style="margin: 0 0 10px 0; color: #8b7355;">Location</h3>
                <p style="margin: 5px 0; color: #666; font-size: 11px;">
                    ${lat.toFixed(4)}°, ${lng.toFixed(4)}°
                </p>
                <p style="margin: 5px 0; color: #999; font-size: 10px;">
                    No nearby citystates
                </p>
                <div style="margin-top: 10px;">
                    <button onclick="window.citystateViewer?.closeClickPopup()"
                            style="background: #ccc; color: #333; border: none; padding: 6px 12px;
                                   border-radius: 5px; cursor: pointer; font-size: 12px;">
                        Close
                    </button>
                </div>
            </div>
        `;

        this.clickPopup = L.popup({
            maxWidth: 200,
            closeButton: false
        })
            .setLatLng(latlng)
            .setContent(popupContent)
            .openOn(this.map);

        // Make this instance globally accessible for popup callbacks
        window.citystateViewer = this;
    }

    viewCitystateDetails(citystateName) {
        console.log(`Viewing details for citystate: ${citystateName}`);

        // Close the popup
        this.closeClickPopup();

        // Switch to local mode
        this.switchToLocalMode();

        // Load the citystate
        this.loadCitystate(citystateName).catch(error => {
            console.error(`Failed to load citystate ${citystateName}:`, error);
            alert(`Unable to load details for ${citystateName}`);
        });
    }

    closeClickPopup() {
        if (this.clickPopup) {
            this.map.removeLayer(this.clickPopup);
            this.clickPopup = null;
        }
    }

    // Minimap functionality for global context
    createMiniMap() {
        if (this.miniMap) return; // Already exists

        console.log('Creating minimap for global context...');

        // Create minimap container
        const miniMapContainer = document.createElement('div');
        miniMapContainer.id = 'minimap-container';
        miniMapContainer.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 200px;
            height: 150px;
            border: 2px solid #8b7355;
            border-radius: 8px;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            z-index: 1000;
            overflow: hidden;
        `;

        // Add minimap to main map container
        const mainMapContainer = document.getElementById(this.mapElementId);
        if (mainMapContainer) {
            mainMapContainer.appendChild(miniMapContainer);
        } else {
            document.body.appendChild(miniMapContainer);
        }

        // Create the minimap instance
        this.miniMap = L.map('minimap-container', {
            center: this.config.globalCenter,
            zoom: 4,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            touchZoom: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false
        });

        // Add global tiles to minimap
        L.tileLayer(this.config.globalTileUrl, {
            minZoom: 0,
            maxZoom: 8,
            opacity: 0.8,
            tms: true
        }).addTo(this.miniMap);

        // Add click handler to minimap for quick navigation
        this.miniMap.on('click', (e) => {
            this.handleMiniMapClick(e);
        });

        // Add title
        const minimapTitle = document.createElement('div');
        minimapTitle.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(139, 115, 85, 0.9);
            color: white;
            text-align: center;
            padding: 2px;
            font-size: 11px;
            font-weight: bold;
            z-index: 1001;
        `;
        minimapTitle.textContent = 'Global View';
        miniMapContainer.appendChild(minimapTitle);

        console.log('Minimap created successfully');
    }

    destroyMiniMap() {
        if (this.miniMap) {
            this.miniMap.remove();
            this.miniMap = null;
        }

        if (this.miniMapMarker) {
            this.miniMapMarker = null;
        }

        const container = document.getElementById('minimap-container');
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }

        console.log('Minimap destroyed');
    }

    updateMiniMapMarker(lat, lng, citystateName) {
        if (!this.miniMap) return;

        // Remove existing marker
        if (this.miniMapMarker) {
            this.miniMap.removeLayer(this.miniMapMarker);
        }

        // Add new marker for current citystate
        this.miniMapMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'minimap-marker',
                html: '📍',
                iconSize: [20, 20],
                iconAnchor: [10, 20]
            })
        }).addTo(this.miniMap);

        // Add popup to marker
        this.miniMapMarker.bindPopup(`
            <div style="text-align: center; padding: 2px;">
                <strong>${citystateName}</strong><br>
                <small>Current Location</small>
            </div>
        `);

        console.log(`Updated minimap marker for ${citystateName} at ${lat}, ${lng}`);
    }

    handleMiniMapClick(e) {
        // Find nearest citystate to clicked location
        const nearestCitystate = this.findNearestCitystate(e.latlng.lat, e.latlng.lng);

        if (nearestCitystate && nearestCitystate.distance < 5.0) { // Larger radius for minimap
            console.log(`Minimap clicked - switching to ${nearestCitystate.display_name}`);
            this.loadCitystate(nearestCitystate.name);
        } else {
            // Switch to global mode
            console.log('Minimap clicked - switching to global view');
            this.switchToGlobalMode();
        }
    }
}

// CSS styles for the controls - you may want to move this to a separate CSS file
const styles = `
<style>
.citystate-controls {
    position: absolute;
    top: 10px;
    right: 10px;
    background: white;
    padding: 15px;
    border-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 1000;
    max-width: 300px;
}

.map-mode-controls {
    margin-bottom: 10px;
}

.mode-btn {
    padding: 8px 16px;
    margin-right: 5px;
    border: 1px solid #ddd;
    background: #f5f5f5;
    border-radius: 3px;
    cursor: pointer;
}

.mode-btn.active {
    background: #007cba;
    color: white;
}

.citystate-selector {
    margin-bottom: 10px;
}

.citystate-selector select {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 3px;
}

.background-controls {
    margin-bottom: 10px;
}
.background-controls h4 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 14px;
}
.background-controls select {
    width: 100%;
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 13px;
}
.layer-controls {
    margin-bottom: 10px;
}
.layer-controls h4 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 14px;
}

.layer-toggle {
    margin-bottom: 5px;
}

.layer-toggle label {
    display: flex;
    align-items: center;
    cursor: pointer;
}

.layer-toggle input {
    margin-right: 8px;
}

.citystate-info h4 {
    margin: 0 0 10px 0;
    color: #333;
}

.citystate-info ul {
    margin: 5px 0;
    padding-left: 20px;
}

.citystate-info li {
    margin-bottom: 2px;
}
</style>
`;

// Add styles to document head
if (typeof document !== 'undefined') {
    document.head.insertAdjacentHTML('beforeend', styles);
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CitystateMapViewer;
}