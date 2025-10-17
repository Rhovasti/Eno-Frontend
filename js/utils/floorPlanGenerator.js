function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function generateRoomLayout(buildingFootprint, floorLevel, buildingType, specificType, buildingId) {
    const seed = hashString(buildingId) + floorLevel * 1000;
    let rng = seed;

    function random() {
        rng++;
        return seededRandom(rng);
    }

    const bounds = calculateFootprintBounds(buildingFootprint);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const area = width * height;

    const wallThickness = Math.min(width, height) * 0.02;
    const innerBounds = {
        minX: bounds.minX + wallThickness,
        minY: bounds.minY + wallThickness,
        maxX: bounds.maxX - wallThickness,
        maxY: bounds.maxY - wallThickness
    };

    const rooms = [];
    const doors = [];
    const stairs = [];
    const features = [];

    if (floorLevel === -1) {
        generateBasementLayout(innerBounds, rooms, doors, features, random);
    } else if (buildingType === 'residential') {
        generateResidentialLayout(innerBounds, floorLevel, specificType, rooms, doors, stairs, features, random);
    } else if (buildingType === 'commercial') {
        generateCommercialLayout(innerBounds, floorLevel, specificType, rooms, doors, stairs, features, random);
    } else {
        generateOtherLayout(innerBounds, floorLevel, specificType, rooms, doors, stairs, features, random);
    }

    return { rooms, doors, stairs, features, bounds: innerBounds };
}

function generateBasementLayout(bounds, rooms, doors, features, random) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    const storageWidth = width * 0.6;
    const cellarWidth = width * 0.4;

    rooms.push({
        id: 'basement_storage',
        type: 'storage',
        name: 'Storage Room',
        polygon: makeRectangle(bounds.minX, bounds.minY, storageWidth, height)
    });

    rooms.push({
        id: 'basement_cellar',
        type: 'cellar',
        name: 'Cellar',
        polygon: makeRectangle(bounds.minX + storageWidth, bounds.minY, cellarWidth, height)
    });

    doors.push({
        position: [bounds.minX + storageWidth, bounds.minY + height / 2],
        connects: ['basement_storage', 'basement_cellar']
    });

    features.push({
        type: 'stairs',
        position: [bounds.minX + width * 0.1, bounds.minY + height * 0.1],
        connects_to_floor: 0
    });
}

function generateResidentialLayout(bounds, floorLevel, specificType, rooms, doors, stairs, features, random) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    const isMultiUnit = specificType.includes('Tenement') || specificType.includes('Apartment') ||
                        specificType.includes('Dormitory') || specificType.includes('Boarding');

    if (isMultiUnit) {
        const hallwayWidth = width * 0.2;
        const unitWidth = (width - hallwayWidth) / 2;

        rooms.push({
            id: `floor${floorLevel}_hallway`,
            type: 'hallway',
            name: 'Hallway',
            polygon: makeRectangle(bounds.minX, bounds.minY + height * 0.4, width, height * 0.2)
        });

        const unitCount = floorLevel === 0 ? 2 : 2;
        for (let i = 0; i < unitCount; i++) {
            const unitY = i === 0 ? bounds.minY : bounds.minY + height * 0.6;
            const unitHeight = height * 0.4;

            const bedroomWidth = unitWidth * 0.6;
            const livingWidth = unitWidth * 0.4;

            rooms.push({
                id: `floor${floorLevel}_unit${i}_bedroom`,
                type: 'bedroom',
                name: `Unit ${i + 1} Bedroom`,
                polygon: makeRectangle(bounds.minX, unitY, bedroomWidth, unitHeight)
            });

            rooms.push({
                id: `floor${floorLevel}_unit${i}_living`,
                type: 'living',
                name: `Unit ${i + 1} Living`,
                polygon: makeRectangle(bounds.minX + bedroomWidth, unitY, livingWidth, unitHeight)
            });

            doors.push({
                position: [bounds.minX + unitWidth / 2, bounds.minY + height * 0.5],
                connects: [`floor${floorLevel}_hallway`, `floor${floorLevel}_unit${i}_bedroom`]
            });
        }

        stairs.push({
            position: [bounds.minX + width - width * 0.1, bounds.minY + height * 0.5],
            connects_to_floor: floorLevel + 1
        });

    } else {
        const bedroomWidth = width * 0.5;
        const kitchenHeight = height * 0.4;
        const livingHeight = height * 0.6;

        if (floorLevel === 0) {
            rooms.push({
                id: 'ground_kitchen',
                type: 'kitchen',
                name: 'Kitchen',
                polygon: makeRectangle(bounds.minX, bounds.minY, width * 0.5, kitchenHeight)
            });

            rooms.push({
                id: 'ground_dining',
                type: 'dining',
                name: 'Dining Room',
                polygon: makeRectangle(bounds.minX + width * 0.5, bounds.minY, width * 0.5, kitchenHeight)
            });

            rooms.push({
                id: 'ground_living',
                type: 'living',
                name: 'Living Room',
                polygon: makeRectangle(bounds.minX, bounds.minY + kitchenHeight, width, livingHeight)
            });

            doors.push({
                position: [bounds.minX + width * 0.5, bounds.minY + kitchenHeight / 2],
                connects: ['ground_kitchen', 'ground_dining']
            });

            stairs.push({
                position: [bounds.minX + width * 0.9, bounds.minY + height * 0.9],
                connects_to_floor: 1
            });

        } else {
            const bedroomCount = Math.min(3, Math.floor(1 + random() * 2));
            const bedroomHeight = height / bedroomCount;

            for (let i = 0; i < bedroomCount; i++) {
                rooms.push({
                    id: `floor${floorLevel}_bedroom${i}`,
                    type: 'bedroom',
                    name: `Bedroom ${i + 1}`,
                    polygon: makeRectangle(
                        bounds.minX,
                        bounds.minY + i * bedroomHeight,
                        bedroomWidth,
                        bedroomHeight
                    )
                });
            }

            rooms.push({
                id: `floor${floorLevel}_bathroom`,
                type: 'bathroom',
                name: 'Bathroom',
                polygon: makeRectangle(
                    bounds.minX + bedroomWidth,
                    bounds.minY,
                    width - bedroomWidth,
                    height * 0.3
                )
            });

            rooms.push({
                id: `floor${floorLevel}_storage`,
                type: 'storage',
                name: 'Storage',
                polygon: makeRectangle(
                    bounds.minX + bedroomWidth,
                    bounds.minY + height * 0.3,
                    width - bedroomWidth,
                    height * 0.7
                )
            });

            stairs.push({
                position: [bounds.minX + width * 0.9, bounds.minY + height * 0.9],
                connects_to_floor: floorLevel + 1
            });
        }
    }
}

function generateCommercialLayout(bounds, floorLevel, specificType, rooms, doors, stairs, features, random) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    if (floorLevel === 0) {
        const isShop = specificType.includes('Shop') || specificType.includes('Store') ||
                       specificType.includes('Stall') || specificType.includes('Market');
        const isTavern = specificType.includes('Tavern') || specificType.includes('Inn') ||
                         specificType.includes('Alehouse');
        const isGuild = specificType.includes('Guild');

        if (isShop) {
            rooms.push({
                id: 'ground_shopfloor',
                type: 'shop',
                name: 'Shop Floor',
                polygon: makeRectangle(bounds.minX, bounds.minY, width * 0.7, height)
            });

            rooms.push({
                id: 'ground_storage',
                type: 'storage',
                name: 'Storage',
                polygon: makeRectangle(bounds.minX + width * 0.7, bounds.minY, width * 0.3, height * 0.6)
            });

            rooms.push({
                id: 'ground_counter',
                type: 'counter',
                name: 'Counter',
                polygon: makeRectangle(bounds.minX + width * 0.7, bounds.minY + height * 0.6, width * 0.3, height * 0.4)
            });

        } else if (isTavern) {
            rooms.push({
                id: 'ground_common',
                type: 'common_room',
                name: 'Common Room',
                polygon: makeRectangle(bounds.minX, bounds.minY, width * 0.6, height * 0.7)
            });

            rooms.push({
                id: 'ground_bar',
                type: 'bar',
                name: 'Bar',
                polygon: makeRectangle(bounds.minX + width * 0.6, bounds.minY, width * 0.4, height * 0.7)
            });

            rooms.push({
                id: 'ground_kitchen',
                type: 'kitchen',
                name: 'Kitchen',
                polygon: makeRectangle(bounds.minX, bounds.minY + height * 0.7, width, height * 0.3)
            });

            features.push({
                type: 'tables',
                count: 8,
                room: 'ground_common'
            });

        } else if (isGuild) {
            rooms.push({
                id: 'ground_workshop',
                type: 'workshop',
                name: 'Workshop',
                polygon: makeRectangle(bounds.minX, bounds.minY, width * 0.6, height)
            });

            rooms.push({
                id: 'ground_office',
                type: 'office',
                name: 'Guild Office',
                polygon: makeRectangle(bounds.minX + width * 0.6, bounds.minY, width * 0.4, height * 0.5)
            });

            rooms.push({
                id: 'ground_storage',
                type: 'storage',
                name: 'Storage',
                polygon: makeRectangle(bounds.minX + width * 0.6, bounds.minY + height * 0.5, width * 0.4, height * 0.5)
            });

        } else {
            rooms.push({
                id: 'ground_main',
                type: 'commercial',
                name: 'Main Floor',
                polygon: makeRectangle(bounds.minX, bounds.minY, width * 0.7, height)
            });

            rooms.push({
                id: 'ground_back',
                type: 'storage',
                name: 'Back Room',
                polygon: makeRectangle(bounds.minX + width * 0.7, bounds.minY, width * 0.3, height)
            });
        }

        stairs.push({
            position: [bounds.minX + width * 0.9, bounds.minY + height * 0.9],
            connects_to_floor: 1
        });

    } else {
        const roomCount = 2 + Math.floor(random() * 2);
        const roomHeight = height / roomCount;

        for (let i = 0; i < roomCount; i++) {
            rooms.push({
                id: `floor${floorLevel}_room${i}`,
                type: 'quarters',
                name: `Private Room ${i + 1}`,
                polygon: makeRectangle(
                    bounds.minX,
                    bounds.minY + i * roomHeight,
                    width,
                    roomHeight
                )
            });
        }

        stairs.push({
            position: [bounds.minX + width * 0.9, bounds.minY + height * 0.9],
            connects_to_floor: floorLevel + 1
        });
    }
}

function generateOtherLayout(bounds, floorLevel, specificType, rooms, doors, stairs, features, random) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    if (specificType.includes('Town Hall') || specificType.includes('Courthouse')) {
        if (floorLevel === 0) {
            rooms.push({
                id: 'ground_hall',
                type: 'great_hall',
                name: 'Great Hall',
                polygon: makeRectangle(bounds.minX, bounds.minY, width, height * 0.7)
            });

            rooms.push({
                id: 'ground_office1',
                type: 'office',
                name: 'Office 1',
                polygon: makeRectangle(bounds.minX, bounds.minY + height * 0.7, width * 0.5, height * 0.3)
            });

            rooms.push({
                id: 'ground_office2',
                type: 'office',
                name: 'Office 2',
                polygon: makeRectangle(bounds.minX + width * 0.5, bounds.minY + height * 0.7, width * 0.5, height * 0.3)
            });
        } else {
            const officeCount = 3;
            const officeHeight = height / officeCount;

            for (let i = 0; i < officeCount; i++) {
                rooms.push({
                    id: `floor${floorLevel}_office${i}`,
                    type: 'office',
                    name: `Office ${i + 1}`,
                    polygon: makeRectangle(
                        bounds.minX,
                        bounds.minY + i * officeHeight,
                        width,
                        officeHeight
                    )
                });
            }
        }

        stairs.push({
            position: [bounds.minX + width * 0.9, bounds.minY + height * 0.9],
            connects_to_floor: floorLevel + 1
        });

    } else if (specificType.includes('Chapel') || specificType.includes('Temple')) {
        rooms.push({
            id: `floor${floorLevel}_chapel`,
            type: 'chapel',
            name: 'Chapel',
            polygon: makeRectangle(bounds.minX, bounds.minY, width * 0.8, height)
        });

        rooms.push({
            id: `floor${floorLevel}_altar`,
            type: 'altar',
            name: 'Altar Room',
            polygon: makeRectangle(bounds.minX + width * 0.8, bounds.minY, width * 0.2, height)
        });

    } else {
        rooms.push({
            id: `floor${floorLevel}_main`,
            type: 'main',
            name: 'Main Room',
            polygon: makeRectangle(bounds.minX, bounds.minY, width, height)
        });
    }
}

function makeRectangle(x, y, width, height) {
    return [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
        [x, y]
    ];
}

function calculateFootprintBounds(footprint) {
    if (!footprint || !footprint.coordinates) {
        return { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    }

    const coords = footprint.type === 'Polygon'
        ? footprint.coordinates[0]
        : footprint.coordinates[0][0];

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const [x, y] of coords) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    return { minX, minY, maxX, maxY };
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

module.exports = {
    generateRoomLayout
};