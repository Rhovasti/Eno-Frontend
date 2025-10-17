const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const REGIONS_DATA_PATH = path.join(__dirname, '../../../..', 'Mundi', 'mundi.ai', 'regions.geojson');
const CITIES_DATA_PATH = path.join(__dirname, '../../../..', 'Mundi', 'mundi.ai', 'eno-cities-scaled.geojson');
const VILLAGES_DATA_PATH = path.join(__dirname, '../../../..', 'Mundi', 'mundi.ai', 'eno-villages-scaled.geojson');

async function loadJSONFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading ${filePath}:`, error.message);
        return null;
    }
}

router.get('/regions', async (req, res) => {
    try {
        const regionsData = await loadJSONFile(REGIONS_DATA_PATH);

        if (!regionsData) {
            return res.status(500).json({ error: 'Failed to load regions data' });
        }

        const regions = regionsData.features.map(feature => ({
            id: feature.properties.regionId,
            name: feature.properties.name,
            population: feature.properties.population,
            cityCount: feature.properties.cityCount,
            primaryCulture: feature.properties.primaryCulture,
            primaryReligion: feature.properties.primaryReligion,
            centroid: feature.properties.centroid
        }));

        res.json({
            success: true,
            count: regions.length,
            regions
        });
    } catch (error) {
        console.error('Error in /regions:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/regions/:regionId', async (req, res) => {
    try {
        const { regionId } = req.params;

        const [regionsData, citiesData, villagesData] = await Promise.all([
            loadJSONFile(REGIONS_DATA_PATH),
            loadJSONFile(CITIES_DATA_PATH),
            loadJSONFile(VILLAGES_DATA_PATH)
        ]);

        if (!regionsData) {
            return res.status(500).json({ error: 'Failed to load regions data' });
        }

        const region = regionsData.features.find(
            f => f.properties.regionId === regionId
        );

        if (!region) {
            return res.status(404).json({ error: `Region '${regionId}' not found` });
        }

        const regionCityNames = region.properties.cities;

        const citystatesInRegion = citiesData ? citiesData.features.filter(city =>
            regionCityNames.includes(city.properties.Burg)
        ) : [];

        const bounds = region.geometry && region.geometry.coordinates && region.geometry.coordinates[0]
            ? calculateBounds(region.geometry.coordinates[0])
            : [0, 0, 0, 0];

        const response = {
            type: 'FeatureCollection',
            regionName: region.properties.name,
            regionId: region.properties.regionId,
            bounds: bounds,
            metadata: {
                population: region.properties.population,
                cityCount: region.properties.cityCount,
                primaryCulture: region.properties.primaryCulture,
                primaryReligion: region.properties.primaryReligion,
                cultures: region.properties.cultures,
                religions: region.properties.religions
            },
            features: {
                region: region,
                citystates: citystatesInRegion,
                villages: villagesData ? filterFeaturesByBounds(villagesData.features, bounds) : []
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error in /regions/:regionId:', error);
        res.status(500).json({ error: error.message });
    }
});

function calculateBounds(coordinates) {
    let minLon = Infinity, minLat = Infinity;
    let maxLon = -Infinity, maxLat = -Infinity;

    for (const [lon, lat] of coordinates) {
        minLon = Math.min(minLon, lon);
        minLat = Math.min(minLat, lat);
        maxLon = Math.max(maxLon, lon);
        maxLat = Math.max(maxLat, lat);
    }

    return [minLon, minLat, maxLon, maxLat];
}

function filterFeaturesByBounds(features, bounds) {
    const [minLon, minLat, maxLon, maxLat] = bounds;

    return features.filter(feature => {
        if (!feature || !feature.geometry || !feature.geometry.coordinates) {
            return false;
        }
        const coords = feature.geometry.coordinates;
        if (!coords || coords.length < 2) {
            return false;
        }
        const [lon, lat] = coords;
        return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
    });
}

module.exports = router;