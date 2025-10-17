const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { generateRoomLayout } = require('../../utils/floorPlanGenerator');

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

function calculatePolygonArea(coordinates) {
    if (!coordinates || coordinates.length === 0) return 0;

    const ring = coordinates[0];
    let area = 0;

    for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        area += (x1 * y2) - (x2 * y1);
    }

    return Math.abs(area / 2);
}

function calculateBuildingArea(geometry) {
    if (!geometry || !geometry.coordinates) return 0;

    if (geometry.type === 'Polygon') {
        return calculatePolygonArea(geometry.coordinates);
    } else if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.reduce((total, poly) => {
            return total + calculatePolygonArea(poly);
        }, 0);
    }

    return 0;
}

function getBuildingCenter(geometry) {
    if (!geometry || !geometry.coordinates) return null;

    if (geometry.type === 'Polygon') {
        const coords = geometry.coordinates[0];
        const lon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
        const lat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
        return [lon, lat];
    } else if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates[0][0][0];
    } else if (geometry.type === 'Point') {
        return geometry.coordinates;
    }

    return null;
}

router.get('/citystates/:cityName/buildings', async (req, res) => {
    try {
        const { cityName } = req.params;
        const { district, type, specific_type, limit = 100 } = req.query;
        const normalized = normalizeFilename(cityName);

        const buildingPath = path.join(BASE_DATA_PATH, 'buildings', `buildings_${normalized}.geojson_fixed.geojson_poly.geojson`);
        const buildingData = await loadGeoJSON(buildingPath);

        if (!buildingData) {
            return res.status(404).json({ error: `Buildings not found for ${cityName}` });
        }

        let buildings = buildingData.features;

        if (district) {
            const districtPath = path.join(BASE_DATA_PATH, 'districts', `${normalized}.geojson_fixed.geojson_poly.geojson`);
            const districtData = await loadGeoJSON(districtPath);

            if (districtData) {
                const districtFeatures = districtData.features.filter(
                    f => f.properties.District === district
                );

                if (districtFeatures.length > 0) {
                    buildings = buildings.filter(building => {
                        const center = getBuildingCenter(building.geometry);
                        if (!center) return false;

                        for (const districtFeature of districtFeatures) {
                            if (!districtFeature.geometry) continue;

                            const districtCoords = districtFeature.geometry.type === 'Polygon'
                                ? districtFeature.geometry.coordinates[0]
                                : districtFeature.geometry.coordinates[0][0];

                            if (pointInPolygon(center, districtCoords)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
            }
        }

        if (type) {
            buildings = buildings.filter(b => b.properties.type === type);
        }

        if (specific_type) {
            buildings = buildings.filter(b => b.properties.specific_type === specific_type);
        }

        const buildingLimit = parseInt(limit);
        const limitedBuildings = buildings.slice(0, buildingLimit);

        const buildingSummaries = limitedBuildings.map(b => ({
            id: b.properties.id,
            type: b.properties.type,
            specific_type: b.properties.specific_type,
            floors: parseInt(b.properties.floors) || 1,
            age: parseInt(b.properties.age) || 0,
            occupants: b.properties.occupants,
            center: getBuildingCenter(b.geometry),
            area: calculateBuildingArea(b.geometry)
        }));

        const typeStats = {};
        const specificTypeStats = {};
        buildings.forEach(b => {
            const t = b.properties.type || 'unknown';
            const st = b.properties.specific_type || 'unknown';
            typeStats[t] = (typeStats[t] || 0) + 1;
            specificTypeStats[st] = (specificTypeStats[st] || 0) + 1;
        });

        res.json({
            success: true,
            cityName: cityName,
            totalBuildings: buildings.length,
            returnedBuildings: buildingSummaries.length,
            filters: {
                district: district || null,
                type: type || null,
                specific_type: specific_type || null
            },
            statistics: {
                byType: typeStats,
                topSpecificTypes: Object.entries(specificTypeStats)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20)
                    .map(([name, count]) => ({ name, count }))
            },
            buildings: buildingSummaries
        });
    } catch (error) {
        console.error('Error in /citystates/:cityName/buildings:', error);
        res.status(500).json({ error: error.message });
    }
});

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

router.get('/citystates/:cityName/buildings/:buildingId', async (req, res) => {
    try {
        const { cityName, buildingId } = req.params;
        const normalized = normalizeFilename(cityName);

        const buildingPath = path.join(BASE_DATA_PATH, 'buildings', `buildings_${normalized}.geojson_fixed.geojson_poly.geojson`);
        const buildingData = await loadGeoJSON(buildingPath);

        if (!buildingData) {
            return res.status(404).json({ error: `Buildings not found for ${cityName}` });
        }

        const building = buildingData.features.find(
            f => f.properties.id === buildingId
        );

        if (!building) {
            return res.status(404).json({ error: `Building '${buildingId}' not found in ${cityName}` });
        }

        const floors = parseInt(building.properties.floors) || 1;
        const hasSubterrain = building.properties.subterrain_level === 'Yes';
        const floorList = [];

        if (hasSubterrain) {
            floorList.push({ level: -1, name: 'Basement', type: 'subterrain' });
        }

        for (let i = 0; i < floors; i++) {
            floorList.push({
                level: i,
                name: i === 0 ? 'Ground Floor' : `Floor ${i}`,
                type: 'main'
            });
        }

        const response = {
            type: 'Feature',
            cityName: cityName,
            buildingId: buildingId,
            properties: {
                id: building.properties.id,
                type: building.properties.type,
                specific_type: building.properties.specific_type,
                age: parseInt(building.properties.age) || 0,
                generation: parseInt(building.properties.generation) || 0,
                floors: floors,
                hasSubterrain: hasSubterrain,
                occupants: building.properties.occupants,
                bodies: building.properties.bodies,
                souls: building.properties.souls,
                jobs: building.properties.jobs,
                employees: building.properties.employees
            },
            metadata: {
                area: calculateBuildingArea(building.geometry),
                center: getBuildingCenter(building.geometry),
                floorCount: floorList.length,
                floors: floorList
            },
            geometry: building.geometry
        };

        res.json(response);
    } catch (error) {
        console.error('Error in /citystates/:cityName/buildings/:buildingId:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/citystates/:cityName/buildings/:buildingId/floor/:floorLevel', async (req, res) => {
    try {
        const { cityName, buildingId, floorLevel } = req.params;
        const normalized = normalizeFilename(cityName);
        const level = parseInt(floorLevel);

        const buildingPath = path.join(BASE_DATA_PATH, 'buildings', `buildings_${normalized}.geojson_fixed.geojson_poly.geojson`);
        const buildingData = await loadGeoJSON(buildingPath);

        if (!buildingData) {
            return res.status(404).json({ error: `Buildings not found for ${cityName}` });
        }

        const building = buildingData.features.find(
            f => f.properties.id === buildingId
        );

        if (!building) {
            return res.status(404).json({ error: `Building '${buildingId}' not found in ${cityName}` });
        }

        const floors = parseInt(building.properties.floors) || 1;
        const hasSubterrain = building.properties.subterrain_level === 'Yes';

        const minFloor = hasSubterrain ? -1 : 0;
        const maxFloor = floors - 1;

        if (level < minFloor || level > maxFloor) {
            return res.status(404).json({
                error: `Floor ${level} does not exist. Valid range: ${minFloor} to ${maxFloor}`
            });
        }

        const floorPlan = generateRoomLayout(
            building.geometry,
            level,
            building.properties.type,
            building.properties.specific_type,
            buildingId
        );

        const roomFeatures = floorPlan.rooms.map(room => ({
            type: 'Feature',
            properties: {
                id: room.id,
                type: room.type,
                name: room.name,
                feature_type: 'room'
            },
            geometry: {
                type: 'Polygon',
                coordinates: [room.polygon]
            }
        }));

        const doorFeatures = floorPlan.doors.map((door, idx) => ({
            type: 'Feature',
            properties: {
                id: `door_${idx}`,
                connects: door.connects,
                feature_type: 'door'
            },
            geometry: {
                type: 'Point',
                coordinates: door.position
            }
        }));

        const stairFeatures = floorPlan.stairs.map((stair, idx) => ({
            type: 'Feature',
            properties: {
                id: `stairs_${idx}`,
                connects_to_floor: stair.connects_to_floor,
                feature_type: 'stairs'
            },
            geometry: {
                type: 'Point',
                coordinates: stair.position
            }
        }));

        const otherFeatures = floorPlan.features.map((feature, idx) => ({
            type: 'Feature',
            properties: {
                id: `feature_${idx}`,
                feature_type: feature.type,
                ...feature
            },
            geometry: {
                type: 'Point',
                coordinates: feature.position || [floorPlan.bounds.minX, floorPlan.bounds.minY]
            }
        }));

        const response = {
            type: 'FeatureCollection',
            cityName: cityName,
            buildingId: buildingId,
            floorLevel: level,
            floorName: level === -1 ? 'Basement' : (level === 0 ? 'Ground Floor' : `Floor ${level}`),
            metadata: {
                buildingType: building.properties.type,
                specificType: building.properties.specific_type,
                roomCount: floorPlan.rooms.length,
                doorCount: floorPlan.doors.length,
                hasStairs: floorPlan.stairs.length > 0,
                bounds: floorPlan.bounds
            },
            features: [
                ...roomFeatures,
                ...doorFeatures,
                ...stairFeatures,
                ...otherFeatures
            ]
        };

        res.json(response);
    } catch (error) {
        console.error('Error in /citystates/:cityName/buildings/:buildingId/floor/:floorLevel:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;