/**
 * Temporal Data Export System
 *
 * Provides comprehensive export capabilities for all temporal mapping data
 * including events, character journeys, territories, snapshots, and metadata.
 * Supports multiple export formats and allows selective data export.
 */

class TemporalDataExportSystem {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            enableExport: true,
            defaultFormat: 'json',
            includeMetadata: true,
            compressData: false,
            maxFileSize: 50 * 1024 * 1024, // 50MB
            ...options
        };

        // Export formats
        this.exportFormats = {
            json: 'JSON',
            csv: 'CSV',
            xml: 'XML',
            geojson: 'GeoJSON',
            xlsx: 'Excel',
            kml: 'KML'
        };

        // Data categories
        this.dataCategories = {
            events: 'Historical Events',
            characters: 'Character Data',
            journeys: 'Character Journeys',
            territories: 'Territory Data',
            snapshots: 'Historical Snapshots',
            metadata: 'System Metadata'
        };

        // Registered visualization systems
        this.visualizationSystems = new Map();

        // Export queue and progress tracking
        this.exportQueue = [];
        this.isExporting = false;
        this.exportProgress = 0;

        this.initialize();
    }

    initialize() {
        console.log('Temporal Data Export System initialized');
    }

    /**
     * Register a visualization system for data export
     */
    registerVisualizationSystem(name, system) {
        this.visualizationSystems.set(name, system);
        console.log(`Registered visualization system: ${name}`);
    }

    /**
     * Set export system enabled state
     */
    setExportEnabled(enabled) {
        this.options.enableExport = enabled;
        console.log(`Export system ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Export all temporal data
     */
    async exportAllData(format = 'json', options = {}) {
        if (!this.options.enableExport) {
            throw new Error('Export system is disabled');
        }

        const exportOptions = {
            includeEvents: true,
            includeCharacters: true,
            includeJourneys: true,
            includeTerritories: true,
            includeSnapshots: true,
            includeMetadata: true,
            ...options
        };

        console.log('Starting full data export...');
        this.isExporting = true;
        this.exportProgress = 0;

        try {
            const exportData = await this.collectAllData(exportOptions);
            const formattedData = this.formatData(exportData, format);
            const filename = this.generateFilename('temporal_data_complete', format);

            this.downloadFile(formattedData, filename, this.getMimeType(format));

            console.log('Full data export completed successfully');
            return {
                success: true,
                filename: filename,
                size: formattedData.length,
                recordCount: this.countRecords(exportData)
            };
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        } finally {
            this.isExporting = false;
            this.exportProgress = 100;
        }
    }

    /**
     * Export specific data category
     */
    async exportCategory(category, format = 'json', options = {}) {
        if (!this.options.enableExport) {
            throw new Error('Export system is disabled');
        }

        console.log(`Exporting ${category} data...`);
        this.isExporting = true;
        this.exportProgress = 0;

        try {
            let data;
            switch (category) {
                case 'events':
                    data = await this.collectEventData(options);
                    break;
                case 'characters':
                    data = await this.collectCharacterData(options);
                    break;
                case 'journeys':
                    data = await this.collectJourneyData(options);
                    break;
                case 'territories':
                    data = await this.collectTerritoryData(options);
                    break;
                case 'snapshots':
                    data = await this.collectSnapshotData(options);
                    break;
                case 'metadata':
                    data = await this.collectMetadata(options);
                    break;
                default:
                    throw new Error(`Unknown category: ${category}`);
            }

            const formattedData = this.formatData(data, format);
            const filename = this.generateFilename(`temporal_${category}`, format);

            this.downloadFile(formattedData, filename, this.getMimeType(format));

            console.log(`${category} export completed successfully`);
            return {
                success: true,
                category: category,
                filename: filename,
                size: formattedData.length,
                recordCount: Array.isArray(data) ? data.length : Object.keys(data).length
            };
        } catch (error) {
            console.error(`Export failed for ${category}:`, error);
            throw error;
        } finally {
            this.isExporting = false;
            this.exportProgress = 100;
        }
    }

    /**
     * Collect all data from registered systems
     */
    async collectAllData(options) {
        const allData = {
            exportMetadata: this.generateExportMetadata(),
            timestamp: new Date().toISOString()
        };

        this.exportProgress = 10;

        if (options.includeEvents) {
            allData.events = await this.collectEventData();
            this.exportProgress = 25;
        }

        if (options.includeCharacters) {
            allData.characters = await this.collectCharacterData();
            this.exportProgress = 40;
        }

        if (options.includeJourneys) {
            allData.journeys = await this.collectJourneyData();
            this.exportProgress = 55;
        }

        if (options.includeTerritories) {
            allData.territories = await this.collectTerritoryData();
            this.exportProgress = 70;
        }

        if (options.includeSnapshots) {
            allData.snapshots = await this.collectSnapshotData();
            this.exportProgress = 85;
        }

        if (options.includeMetadata) {
            allData.systemMetadata = await this.collectMetadata();
            this.exportProgress = 95;
        }

        return allData;
    }

    /**
     * Collect event data from temporal extension
     */
    async collectEventData(options = {}) {
        const events = [];

        // Get events from temporal extension if available
        const temporalSystem = this.visualizationSystems.get('temporalExtension');
        if (temporalSystem && typeof temporalSystem.getEvents === 'function') {
            const systemEvents = temporalSystem.getEvents();
            events.push(...systemEvents);
        }

        // Add sample historical events for demonstration
        events.push(
            {
                id: 'event_001',
                title: 'Foundation of Northern Kingdom',
                description: 'Establishment of the first major political entity',
                location: { lat: 45.5, lon: 12.3 },
                timeRange: { start: -5000, end: -4950 },
                category: 'political',
                significance: 0.9,
                participants: ['King Aldric I', 'Council of Elders'],
                consequences: ['Political stability', 'Trade route establishment']
            },
            {
                id: 'event_002',
                title: 'The Great Migration',
                description: 'Mass movement of peoples across the continent',
                location: { lat: 47.2, lon: 8.7 },
                timeRange: { start: -3000, end: -2800 },
                category: 'demographic',
                significance: 0.8,
                participants: ['Nomadic Tribes', 'Settler Groups'],
                consequences: ['Cultural exchange', 'New settlements']
            },
            {
                id: 'event_003',
                title: 'Discovery of Iron Deposits',
                description: 'Major mineral discovery changing technology',
                location: { lat: 46.8, lon: 10.1 },
                timeRange: { start: -2500, end: -2500 },
                category: 'technological',
                significance: 0.7,
                participants: ['Miners Guild', 'Local Chieftains'],
                consequences: ['Technological advancement', 'Economic growth']
            }
        );

        return events;
    }

    /**
     * Collect character data from journey system
     */
    async collectCharacterData(options = {}) {
        const characters = [];

        const journeySystem = this.visualizationSystems.get('characterJourneySystem');
        if (journeySystem && typeof journeySystem.getCharacterList === 'function') {
            const systemCharacters = journeySystem.getCharacterList();
            characters.push(...systemCharacters);
        }

        // Add sample character data
        characters.push(
            {
                id: 'char_001',
                name: 'Aldric the Founder',
                type: 'ruler',
                lifespan: { birth: -5020, death: -4965 },
                locations: [
                    { lat: 45.5, lon: 12.3, time: -5000, event: 'Founded Northern Kingdom' },
                    { lat: 45.7, lon: 12.5, time: -4980, event: 'Established capital' }
                ],
                attributes: {
                    influence: 0.9,
                    diplomacy: 0.8,
                    warfare: 0.7
                },
                relationships: ['Queen Mira', 'General Theron'],
                achievements: ['Kingdom Foundation', 'Peace Treaties']
            },
            {
                id: 'char_002',
                name: 'Mira the Wise',
                type: 'scholar',
                lifespan: { birth: -4995, death: -4920 },
                locations: [
                    { lat: 45.6, lon: 12.4, time: -4980, event: 'Established Academy' },
                    { lat: 45.8, lon: 12.6, time: -4950, event: 'Great Library founding' }
                ],
                attributes: {
                    knowledge: 0.95,
                    influence: 0.6,
                    innovation: 0.9
                },
                relationships: ['Aldric the Founder', 'Scholar Circle'],
                achievements: ['Academy Foundation', 'Knowledge Preservation']
            }
        );

        return characters;
    }

    /**
     * Collect journey data from character system
     */
    async collectJourneyData(options = {}) {
        const journeys = [];

        const journeySystem = this.visualizationSystems.get('characterJourneySystem');
        if (journeySystem && typeof journeySystem.getJourneyPaths === 'function') {
            const systemJourneys = journeySystem.getJourneyPaths();
            journeys.push(...systemJourneys);
        }

        // Add sample journey data
        journeys.push(
            {
                id: 'journey_001',
                characterId: 'char_001',
                characterName: 'Aldric the Founder',
                path: [
                    { lat: 44.5, lon: 11.0, time: -5020, event: 'Birth' },
                    { lat: 45.0, lon: 11.5, time: -5000, event: 'Became chieftain' },
                    { lat: 45.5, lon: 12.3, time: -4990, event: 'Founded kingdom' },
                    { lat: 45.7, lon: 12.5, time: -4980, event: 'Built capital' },
                    { lat: 45.5, lon: 12.3, time: -4965, event: 'Death' }
                ],
                totalDistance: 156.7,
                duration: 55,
                significantEvents: 4,
                influence: { start: 0.2, peak: 0.9, end: 0.8 }
            },
            {
                id: 'journey_002',
                characterId: 'char_002',
                characterName: 'Mira the Wise',
                path: [
                    { lat: 45.2, lon: 12.0, time: -4995, event: 'Birth' },
                    { lat: 45.6, lon: 12.4, time: -4980, event: 'Founded Academy' },
                    { lat: 45.8, lon: 12.6, time: -4950, event: 'Great Library' },
                    { lat: 45.6, lon: 12.4, time: -4920, event: 'Death' }
                ],
                totalDistance: 89.3,
                duration: 75,
                significantEvents: 3,
                influence: { start: 0.1, peak: 0.7, end: 0.9 }
            }
        );

        return journeys;
    }

    /**
     * Collect territory data from animation system
     */
    async collectTerritoryData(options = {}) {
        const territories = [];

        const territorySystem = this.visualizationSystems.get('territoryAnimationSystem');
        if (territorySystem && typeof territorySystem.getTerritorialData === 'function') {
            const systemTerritories = territorySystem.getTerritorialData();
            territories.push(...systemTerritories);
        }

        // Add sample territory data
        territories.push(
            {
                id: 'territory_001',
                name: 'Northern Kingdom',
                factionId: 'northern_kingdom',
                timeRange: { start: -5000, end: 0 },
                boundaries: [
                    [45.0, 12.0], [46.0, 12.0], [46.0, 13.0], [45.0, 13.0], [45.0, 12.0]
                ],
                area: 10000, // square km
                population: { start: 50000, peak: 200000, end: 180000 },
                capital: { name: 'Aldricsburg', lat: 45.5, lon: 12.5 },
                resources: ['Iron', 'Timber', 'Grain'],
                conflicts: ['Border War 4800', 'Succession Crisis 4200']
            },
            {
                id: 'territory_002',
                name: 'Eastern Principalities',
                factionId: 'eastern_alliance',
                timeRange: { start: -4500, end: -1000 },
                boundaries: [
                    [46.0, 13.0], [47.0, 13.0], [47.0, 14.0], [46.0, 14.0], [46.0, 13.0]
                ],
                area: 8500,
                population: { start: 30000, peak: 150000, end: 120000 },
                capital: { name: 'Eastport', lat: 46.5, lon: 13.5 },
                resources: ['Fish', 'Salt', 'Stone'],
                conflicts: ['Trade War 4200', 'Naval Conflict 3800']
            }
        );

        return territories;
    }

    /**
     * Collect snapshot data from snapshot system
     */
    async collectSnapshotData(options = {}) {
        const snapshots = [];

        const snapshotSystem = this.visualizationSystems.get('historicalSnapshotSystem');
        if (snapshotSystem && typeof snapshotSystem.getSnapshotList === 'function') {
            const systemSnapshots = snapshotSystem.getSnapshotList();
            snapshots.push(...systemSnapshots);
        }

        return snapshots;
    }

    /**
     * Collect system metadata
     */
    async collectMetadata(options = {}) {
        return {
            systemInfo: {
                version: '1.0.0',
                components: Array.from(this.visualizationSystems.keys()),
                exportTimestamp: new Date().toISOString(),
                mapCenter: this.map ? [this.map.getCenter().lat, this.map.getCenter().lng] : null,
                mapZoom: this.map ? this.map.getZoom() : null
            },
            dataStats: {
                totalSystems: this.visualizationSystems.size,
                exportFormats: Object.keys(this.exportFormats),
                dataCategories: Object.keys(this.dataCategories)
            },
            options: this.options
        };
    }

    /**
     * Format data according to specified format
     */
    formatData(data, format) {
        switch (format.toLowerCase()) {
            case 'json':
                return JSON.stringify(data, null, 2);

            case 'csv':
                return this.convertToCSV(data);

            case 'xml':
                return this.convertToXML(data);

            case 'geojson':
                return this.convertToGeoJSON(data);

            case 'xlsx':
                return this.convertToExcel(data);

            case 'kml':
                return this.convertToKML(data);

            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }

    /**
     * Convert data to CSV format
     */
    convertToCSV(data) {
        const csvLines = [];

        // Handle different data structures
        if (data.events && Array.isArray(data.events)) {
            csvLines.push('# EVENTS');
            csvLines.push('ID,Title,Description,Latitude,Longitude,StartTime,EndTime,Category,Significance');

            data.events.forEach(event => {
                const line = [
                    event.id,
                    `"${event.title}"`,
                    `"${event.description}"`,
                    event.location?.lat || '',
                    event.location?.lon || '',
                    event.timeRange?.start || '',
                    event.timeRange?.end || '',
                    event.category || '',
                    event.significance || ''
                ].join(',');
                csvLines.push(line);
            });
        }

        if (data.characters && Array.isArray(data.characters)) {
            csvLines.push('');
            csvLines.push('# CHARACTERS');
            csvLines.push('ID,Name,Type,Birth,Death,Influence,Diplomacy,Warfare');

            data.characters.forEach(character => {
                const line = [
                    character.id,
                    `"${character.name}"`,
                    character.type,
                    character.lifespan?.birth || '',
                    character.lifespan?.death || '',
                    character.attributes?.influence || '',
                    character.attributes?.diplomacy || '',
                    character.attributes?.warfare || ''
                ].join(',');
                csvLines.push(line);
            });
        }

        return csvLines.join('\n');
    }

    /**
     * Convert data to XML format
     */
    convertToXML(data) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<temporalData>\n';
        xml += `  <exportTimestamp>${data.timestamp || new Date().toISOString()}</exportTimestamp>\n`;

        Object.keys(data).forEach(key => {
            if (key !== 'timestamp' && key !== 'exportMetadata') {
                xml += `  <${key}>\n`;

                if (Array.isArray(data[key])) {
                    data[key].forEach(item => {
                        xml += this.objectToXML(item, 4);
                    });
                } else {
                    xml += this.objectToXML(data[key], 4);
                }

                xml += `  </${key}>\n`;
            }
        });

        xml += '</temporalData>';
        return xml;
    }

    /**
     * Convert object to XML helper
     */
    objectToXML(obj, indent = 0) {
        const spaces = ' '.repeat(indent);
        let xml = '';

        if (typeof obj === 'object' && obj !== null) {
            xml += `${spaces}<item>\n`;
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    xml += `${spaces}  <${key}>\n`;
                    xml += this.objectToXML(obj[key], indent + 4);
                    xml += `${spaces}  </${key}>\n`;
                } else {
                    xml += `${spaces}  <${key}>${obj[key]}</${key}>\n`;
                }
            });
            xml += `${spaces}</item>\n`;
        }

        return xml;
    }

    /**
     * Convert data to GeoJSON format
     */
    convertToGeoJSON(data) {
        const geojson = {
            type: 'FeatureCollection',
            features: []
        };

        // Add events as point features
        if (data.events && Array.isArray(data.events)) {
            data.events.forEach(event => {
                if (event.location && event.location.lat && event.location.lon) {
                    geojson.features.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [event.location.lon, event.location.lat]
                        },
                        properties: {
                            type: 'event',
                            id: event.id,
                            title: event.title,
                            description: event.description,
                            timeStart: event.timeRange?.start,
                            timeEnd: event.timeRange?.end,
                            category: event.category,
                            significance: event.significance
                        }
                    });
                }
            });
        }

        // Add territories as polygon features
        if (data.territories && Array.isArray(data.territories)) {
            data.territories.forEach(territory => {
                if (territory.boundaries && Array.isArray(territory.boundaries)) {
                    geojson.features.push({
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [territory.boundaries]
                        },
                        properties: {
                            type: 'territory',
                            id: territory.id,
                            name: territory.name,
                            factionId: territory.factionId,
                            timeStart: territory.timeRange?.start,
                            timeEnd: territory.timeRange?.end,
                            area: territory.area,
                            population: territory.population
                        }
                    });
                }
            });
        }

        // Add character journeys as line features
        if (data.journeys && Array.isArray(data.journeys)) {
            data.journeys.forEach(journey => {
                if (journey.path && Array.isArray(journey.path)) {
                    const coordinates = journey.path.map(point => [point.lon, point.lat]);
                    geojson.features.push({
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: coordinates
                        },
                        properties: {
                            type: 'journey',
                            id: journey.id,
                            characterId: journey.characterId,
                            characterName: journey.characterName,
                            totalDistance: journey.totalDistance,
                            duration: journey.duration,
                            significantEvents: journey.significantEvents
                        }
                    });
                }
            });
        }

        return JSON.stringify(geojson, null, 2);
    }

    /**
     * Convert data to Excel format (simplified)
     */
    convertToExcel(data) {
        // This would require a library like SheetJS for full Excel support
        // For now, return CSV with Excel-friendly formatting
        return this.convertToCSV(data);
    }

    /**
     * Convert data to KML format
     */
    convertToKML(data) {
        let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
        kml += '  <Document>\n';
        kml += '    <name>Temporal Map Data</name>\n';
        kml += '    <description>Exported temporal mapping data</description>\n';

        // Add events as placemarks
        if (data.events && Array.isArray(data.events)) {
            data.events.forEach(event => {
                if (event.location && event.location.lat && event.location.lon) {
                    kml += '    <Placemark>\n';
                    kml += `      <name>${event.title}</name>\n`;
                    kml += `      <description><![CDATA[${event.description}<br/>Time: ${event.timeRange?.start} - ${event.timeRange?.end}<br/>Category: ${event.category}]]></description>\n`;
                    kml += '      <Point>\n';
                    kml += `        <coordinates>${event.location.lon},${event.location.lat},0</coordinates>\n`;
                    kml += '      </Point>\n';
                    kml += '    </Placemark>\n';
                }
            });
        }

        kml += '  </Document>\n';
        kml += '</kml>';
        return kml;
    }

    /**
     * Generate appropriate filename
     */
    generateFilename(prefix, format) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return `${prefix}_${timestamp}.${format.toLowerCase()}`;
    }

    /**
     * Get MIME type for format
     */
    getMimeType(format) {
        const mimeTypes = {
            json: 'application/json',
            csv: 'text/csv',
            xml: 'application/xml',
            geojson: 'application/geo+json',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            kml: 'application/vnd.google-earth.kml+xml'
        };
        return mimeTypes[format.toLowerCase()] || 'text/plain';
    }

    /**
     * Download file to user's computer
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up the URL object
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Generate export metadata
     */
    generateExportMetadata() {
        return {
            version: '1.0.0',
            generator: 'Temporal Data Export System',
            timestamp: new Date().toISOString(),
            format: 'temporal-mapping-data',
            description: 'Export from 4D Temporal Mapping System'
        };
    }

    /**
     * Count total records in export data
     */
    countRecords(data) {
        let count = 0;
        Object.keys(data).forEach(key => {
            if (Array.isArray(data[key])) {
                count += data[key].length;
            } else if (typeof data[key] === 'object' && data[key] !== null) {
                count += Object.keys(data[key]).length;
            }
        });
        return count;
    }

    /**
     * Get export progress (0-100)
     */
    getExportProgress() {
        return this.exportProgress;
    }

    /**
     * Check if export is in progress
     */
    isExportInProgress() {
        return this.isExporting;
    }

    /**
     * Get available export formats
     */
    getExportFormats() {
        return { ...this.exportFormats };
    }

    /**
     * Get available data categories
     */
    getDataCategories() {
        return { ...this.dataCategories };
    }

    /**
     * Get export statistics
     */
    getExportStats() {
        return {
            formatsSupported: Object.keys(this.exportFormats).length,
            categoriesSupported: Object.keys(this.dataCategories).length,
            systemsRegistered: this.visualizationSystems.size,
            maxFileSize: this.options.maxFileSize,
            isExporting: this.isExporting,
            progress: this.exportProgress
        };
    }
}

// Export the class
window.TemporalDataExportSystem = TemporalDataExportSystem;