const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const BASE_DATA_PATH = path.join(__dirname, '../../../..', 'Mundi', 'mundi.ai', 'Eno', 'karttatiedostot kaupungeista');

async function loadGeoJSON(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading ${filePath}:`, error.message);
        return null;
    }
}

function normalizeFilename(cityName) {
    return cityName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}

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

router.get('/citystates/:cityName/districts', async (req, res) => {
    try {
        const { cityName } = req.params;
        const normalized = normalizeFilename(cityName);

        const districtPath = path.join(BASE_DATA_PATH, 'districts', `${normalized}.geojson_fixed.geojson_poly.geojson`);
        const districtData = await loadGeoJSON(districtPath);

        if (!districtData) {
            return res.status(404).json({ error: `Districts not found for ${cityName}` });
        }

        const districtNames = new Set();
        const districtInfo = {};

        for (const feature of districtData.features) {
            const name = feature.properties.District;
            if (name && !districtInfo[name]) {
                districtInfo[name] = {
                    name: name,
                    type: feature.properties.Type,
                    era: feature.properties.Era,
                    polygonCount: 0
                };
            }
            if (name) districtInfo[name].polygonCount++;
        }

        res.json({
            success: true,
            cityName: cityName,
            districts: Object.values(districtInfo)
        });
    } catch (error) {
        console.error('Error in /citystates/:cityName/districts:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/citystates/:cityName/districts/:districtName', async (req, res) => {
    try {
        const { cityName, districtName } = req.params;
        const normalized = normalizeFilename(cityName);

        const [districtData, buildingData] = await Promise.all([
            loadGeoJSON(path.join(BASE_DATA_PATH, 'districts', `${normalized}.geojson_fixed.geojson_poly.geojson`)),
            loadGeoJSON(path.join(BASE_DATA_PATH, 'buildings', `buildings_${normalized}.geojson_fixed.geojson_poly.geojson`))
        ]);

        if (!districtData) {
            return res.status(404).json({ error: `Districts not found for ${cityName}` });
        }

        const districtFeatures = districtData.features.filter(
            f => f.properties.District === districtName
        );

        if (districtFeatures.length === 0) {
            return res.status(404).json({ error: `District '${districtName}' not found in ${cityName}` });
        }

        let allCoords = [];
        for (const feature of districtFeatures) {
            if (feature.geometry && feature.geometry.coordinates) {
                if (feature.geometry.type === 'Polygon') {
                    allCoords.push(...feature.geometry.coordinates[0]);
                } else if (feature.geometry.type === 'MultiPolygon') {
                    for (const poly of feature.geometry.coordinates) {
                        allCoords.push(...poly[0]);
                    }
                }
            }
        }

        const bounds = allCoords.length > 0 ? calculateBounds(allCoords) : [0, 0, 0, 0];

        let buildingsInDistrict = [];
        if (buildingData) {
            for (const building of buildingData.features) {
                if (!building.geometry || !building.geometry.coordinates) continue;

                const buildingCoords = building.geometry.coordinates;
                let buildingCenter;

                if (building.geometry.type === 'Polygon') {
                    buildingCenter = buildingCoords[0][0];
                } else if (building.geometry.type === 'MultiPolygon') {
                    buildingCenter = buildingCoords[0][0][0];
                } else if (building.geometry.type === 'Point') {
                    buildingCenter = buildingCoords;
                } else {
                    continue;
                }

                for (const districtFeature of districtFeatures) {
                    if (!districtFeature.geometry) continue;

                    const districtCoords = districtFeature.geometry.type === 'Polygon'
                        ? districtFeature.geometry.coordinates[0]
                        : districtFeature.geometry.coordinates[0][0];

                    if (pointInPolygon(buildingCenter, districtCoords)) {
                        buildingsInDistrict.push(building);
                        break;
                    }
                }
            }
        }

        const buildingTypes = {};
        const specificTypes = {};
        for (const b of buildingsInDistrict) {
            const type = b.properties.type || 'unknown';
            const specific = b.properties.specific_type || 'unknown';
            buildingTypes[type] = (buildingTypes[type] || 0) + 1;
            specificTypes[specific] = (specificTypes[specific] || 0) + 1;
        }

        const response = {
            type: 'FeatureCollection',
            cityName: cityName,
            districtName: districtName,
            bounds: bounds,
            metadata: {
                buildingCount: buildingsInDistrict.length,
                districtType: districtFeatures[0].properties.Type,
                era: districtFeatures[0].properties.Era,
                polygonCount: districtFeatures.length,
                buildingTypes: buildingTypes,
                topSpecificTypes: Object.entries(specificTypes)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([name, count]) => ({ name, count }))
            },
            features: {
                districtBoundary: {
                    type: 'FeatureCollection',
                    features: districtFeatures
                },
                buildings: {
                    type: 'FeatureCollection',
                    features: buildingsInDistrict
                }
            }
        };

        res.json(response);
    } catch (error) {
        console.error('Error in /citystates/:cityName/districts/:districtName:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;