/**
 * Temporal Data API Routes
 *
 * Provides data endpoints for the 4D temporal mapping system
 * Bridges the backend data with the temporal visualization components
 */

const express = require('express');
const router = express.Router();

// Helper function to generate sample temporal data
function generateSampleTemporalData() {
    const currentTime = Date.now();

    return {
        events: [
            {
                id: 'event_001',
                title: 'Foundation of Northern Kingdom',
                description: 'Establishment of the first major political entity in the northern regions',
                location: { lat: 45.5, lon: 12.3 },
                timeRange: { start: -5000, end: -4950 },
                category: 'political',
                significance: 0.9,
                participants: ['King Aldric I', 'Council of Elders'],
                consequences: ['Political stability established', 'Trade route networks created'],
                tags: ['kingdom', 'foundation', 'politics'],
                createdAt: currentTime,
                updatedAt: currentTime
            },
            {
                id: 'event_002',
                title: 'The Great Migration',
                description: 'Mass movement of peoples across the continent following climate changes',
                location: { lat: 47.2, lon: 8.7 },
                timeRange: { start: -3000, end: -2800 },
                category: 'demographic',
                significance: 0.8,
                participants: ['Nomadic Tribes', 'Settler Groups', 'Local Populations'],
                consequences: ['Cultural exchange', 'New settlements established', 'Language mixing'],
                tags: ['migration', 'demographics', 'culture'],
                createdAt: currentTime,
                updatedAt: currentTime
            },
            {
                id: 'event_003',
                title: 'Discovery of Iron Deposits',
                description: 'Major mineral discovery that changed technological capabilities',
                location: { lat: 46.8, lon: 10.1 },
                timeRange: { start: -2500, end: -2500 },
                category: 'technological',
                significance: 0.7,
                participants: ['Miners Guild', 'Local Chieftains', 'Metalworkers'],
                consequences: ['Iron Age begins', 'Military advancement', 'Economic growth'],
                tags: ['technology', 'mining', 'advancement'],
                createdAt: currentTime,
                updatedAt: currentTime
            }
        ],
        characters: [
            {
                id: 'char_001',
                name: 'Aldric the Founder',
                type: 'ruler',
                lifespan: { birth: -5020, death: -4965 },
                locations: [
                    { lat: 44.5, lon: 11.0, time: -5020, event: 'Birth in mountain village' },
                    { lat: 45.0, lon: 11.5, time: -5000, event: 'Became tribal chieftain' },
                    { lat: 45.5, lon: 12.3, time: -4990, event: 'Founded Northern Kingdom' },
                    { lat: 45.7, lon: 12.5, time: -4980, event: 'Established royal capital' },
                    { lat: 45.5, lon: 12.3, time: -4965, event: 'Death and burial' }
                ],
                attributes: {
                    influence: 0.9,
                    diplomacy: 0.8,
                    warfare: 0.7,
                    leadership: 0.95
                },
                relationships: ['Queen Mira', 'General Theron', 'Advisor Caelum'],
                achievements: ['Kingdom Foundation', 'Peace Treaties', 'Legal Code Creation'],
                description: 'Legendary founder of the Northern Kingdom, known for uniting scattered tribes',
                color: '#3498db'
            },
            {
                id: 'char_002',
                name: 'Mira the Wise',
                type: 'scholar',
                lifespan: { birth: -4995, death: -4920 },
                locations: [
                    { lat: 45.2, lon: 12.0, time: -4995, event: 'Birth in scholar family' },
                    { lat: 45.6, lon: 12.4, time: -4980, event: 'Founded Royal Academy' },
                    { lat: 45.8, lon: 12.6, time: -4950, event: 'Established Great Library' },
                    { lat: 45.6, lon: 12.4, time: -4920, event: 'Death in academy' }
                ],
                attributes: {
                    knowledge: 0.95,
                    influence: 0.6,
                    innovation: 0.9,
                    wisdom: 0.92
                },
                relationships: ['Aldric the Founder', 'Scholar Circle', 'Academy Students'],
                achievements: ['Academy Foundation', 'Knowledge Preservation', 'Educational Reform'],
                description: 'Renowned scholar and advisor, preserved much ancient knowledge',
                color: '#9b59b6'
            }
        ],
        territories: [
            {
                id: 'territory_001',
                name: 'Northern Kingdom',
                factionId: 'northern_kingdom',
                timeRange: { start: -5000, end: 0 },
                boundaries: [
                    [45.0, 12.0], [46.0, 12.0], [46.0, 13.0], [45.0, 13.0], [45.0, 12.0]
                ],
                area: 10000,
                population: { start: 50000, peak: 200000, end: 180000 },
                capital: { name: 'Aldricsburg', lat: 45.5, lon: 12.5 },
                resources: ['Iron', 'Timber', 'Agricultural Land', 'Stone Quarries'],
                conflicts: [
                    { time: -4800, name: 'Border War', description: 'Conflict with eastern tribes' },
                    { time: -4200, name: 'Succession Crisis', description: 'Internal power struggle' }
                ]
            }
        ],
        epochs: [
            {
                id: 'epoch_001',
                name: 'Age of Foundations',
                timeRange: { start: -5500, end: -4000 },
                description: 'Period of early settlement and kingdom formation',
                characteristics: ['Political formation', 'Settlement establishment', 'Cultural development'],
                majorEvents: ['Kingdom Foundation', 'First Laws', 'Trade Networks'],
                color: '#3498db',
                significance: 0.9
            }
        ]
    };
}

// Get all temporal events
router.get('/events', (req, res) => {
    try {
        const data = generateSampleTemporalData();
        let events = data.events;

        // Apply filters if provided
        if (req.query.timeStart) {
            const timeStart = parseInt(req.query.timeStart);
            events = events.filter(event => event.timeRange.end >= timeStart);
        }

        if (req.query.timeEnd) {
            const timeEnd = parseInt(req.query.timeEnd);
            events = events.filter(event => event.timeRange.start <= timeEnd);
        }

        if (req.query.category) {
            events = events.filter(event => event.category === req.query.category);
        }

        res.json({
            success: true,
            events: events,
            total: events.length
        });
    } catch (error) {
        console.error('Error fetching temporal events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch temporal events'
        });
    }
});

// Get all characters
router.get('/characters', (req, res) => {
    try {
        const data = generateSampleTemporalData();
        res.json({
            success: true,
            characters: data.characters,
            total: data.characters.length
        });
    } catch (error) {
        console.error('Error fetching characters:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch characters'
        });
    }
});

// Get complete temporal dataset
router.get('/complete', (req, res) => {
    try {
        const data = generateSampleTemporalData();
        res.json({
            success: true,
            data: data,
            metadata: {
                generated: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    } catch (error) {
        console.error('Error fetching complete temporal data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch complete temporal data'
        });
    }
});

module.exports = router;