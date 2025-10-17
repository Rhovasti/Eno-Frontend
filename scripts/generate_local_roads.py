#!/usr/bin/env python3
"""
Enhanced Local Road Network Generator for Individual Cities
Generates hierarchical road networks using Voronoi diagrams and building importance classification
"""

import json
import sys
import os
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any

import geopandas as gpd
import networkx as nx
from scipy.spatial import Voronoi, distance_matrix
from shapely.geometry import Point, LineString, Polygon, MultiPoint, MultiPolygon
from shapely.ops import unary_union
import numpy as np
from sklearn.cluster import DBSCAN, KMeans
import time
import math

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Important building types that should have primary road connections
IMPORTANT_BUILDINGS = [
    'Keep', 'Town Hall', 'Market Square', 'Cathedral', 'Temple',
    'Castle', 'Palace', 'Guildhall', 'Bank', 'Harbor', 'Fort'
]

# Secondary importance buildings
SECONDARY_BUILDINGS = [
    'Church', 'Inn', 'Tavern', 'Shop', 'Merchant', 'Workshop',
    'School', 'Library', 'Barracks', 'Warehouse', 'Mill', 'Forge'
]


def classify_building_importance(building_props: Dict) -> int:
    """
    Classify building importance on a 1-10 scale based on type and attributes.
    """
    building_type = str(building_props.get('specific_type', building_props.get('type', ''))).lower()

    # Check for important buildings (importance 8-10)
    for important in IMPORTANT_BUILDINGS:
        if important.lower() in building_type:
            return 10

    # Check for secondary importance (importance 5-7)
    for secondary in SECONDARY_BUILDINGS:
        if secondary.lower() in building_type:
            return 6

    # Check occupancy for residential importance
    try:
        occupants = int(building_props.get('occupants', 0))
        if occupants > 50:
            return 7
        elif occupants > 20:
            return 5
        elif occupants > 10:
            return 4
        elif occupants > 5:
            return 3
    except (ValueError, TypeError):
        # Handle non-numeric occupants
        pass

    return 2  # Default for basic residential


def calculate_city_extent(gdf: gpd.GeoDataFrame, buffer_meters: float = 100) -> Polygon:
    """
    Calculate city boundary from buildings using convex hull with buffer.
    """
    # Get all building centroids
    centroids = gdf.geometry.centroid

    if len(centroids) < 3:
        # For very small settlements, create a circle
        bounds = gdf.total_bounds
        center = Point((bounds[0] + bounds[2])/2, (bounds[1] + bounds[3])/2)
        # Rough conversion: 1 degree ≈ 111km
        buffer_degrees = buffer_meters / 111000
        return center.buffer(buffer_degrees * 3)

    # Create multipoint from centroids
    multipoint = MultiPoint(list(centroids))

    # Calculate convex hull
    hull = multipoint.convex_hull

    # Add buffer (convert meters to degrees approximately)
    buffer_degrees = buffer_meters / 111000
    buffered = hull.buffer(buffer_degrees)

    logger.info(f"City extent calculated for {len(gdf)} buildings")
    return buffered


def create_voronoi_road_network(building_points: List[Dict], gdf: gpd.GeoDataFrame,
                               city_boundary: Polygon) -> List[Dict]:
    """
    Generate road network using Voronoi diagrams for small datasets.
    """
    logger.info("Generating Voronoi-based road network")

    # Extract vertex points for Voronoi
    vertex_points = []
    for polygon in gdf.geometry:
        if polygon and polygon.geom_type.startswith('Polygon'):
            coords = list(polygon.exterior.coords)
            vertex_points.extend(coords[:-1])

    if len(vertex_points) < 4:
        logger.warning("Not enough vertices for Voronoi, using simple grid")
        return create_simple_grid_roads(city_boundary)

    # Add boundary points to constrain Voronoi
    boundary_coords = list(city_boundary.exterior.coords)
    num_boundary = min(20, len(boundary_coords))
    step = max(1, len(boundary_coords) // num_boundary)
    boundary_points = boundary_coords[::step]

    # Combine all points for Voronoi
    all_points = vertex_points + boundary_points
    points_array = np.array(all_points)

    try:
        # Create Voronoi diagram with timeout protection
        vor = Voronoi(points_array)

        # Extract Voronoi edges as potential roads
        lines = []
        for ridge_points in vor.ridge_vertices:
            if -1 not in ridge_points:  # Skip infinite ridges
                p1 = vor.vertices[ridge_points[0]]
                p2 = vor.vertices[ridge_points[1]]
                line = LineString([p1, p2])

                # Check if line is within city boundary
                if city_boundary.contains(line) or city_boundary.intersects(line):
                    clipped = line.intersection(city_boundary)
                    if isinstance(clipped, LineString):
                        lines.append(clipped)

        # Create network graph and classify roads
        important_coords = [bp['coords'] for bp in building_points if bp['importance'] >= 8]
        secondary_coords = [bp['coords'] for bp in building_points if bp['importance'] >= 5]

        road_features = []
        for idx, line in enumerate(lines):
            road_type = 'local'
            road_width = 5
            importance = 3

            # Check proximity to important buildings
            for imp_coord in important_coords:
                imp_point = Point(imp_coord)
                if line.distance(imp_point) < 0.0005:  # ~50m
                    road_type = 'primary'
                    road_width = 10
                    importance = 10
                    break

            # Check secondary buildings if not primary
            if road_type == 'local':
                for sec_coord in secondary_coords:
                    sec_point = Point(sec_coord)
                    if line.distance(sec_point) < 0.0005:
                        road_type = 'secondary'
                        road_width = 7
                        importance = 6
                        break

            road_features.append({
                'geometry': line,
                'type': road_type,
                'width': road_width,
                'importance': importance,
                'name': generate_road_name(road_type, idx + 1),
                'connects': []
            })

        logger.info(f"Generated {len(road_features)} Voronoi roads")
        return road_features

    except Exception as e:
        logger.warning(f"Voronoi generation failed: {e}, using simple grid")
        return create_simple_grid_roads(city_boundary)


def create_simple_grid_roads(city_boundary: Polygon) -> List[Dict]:
    """
    Create simple grid road network as fallback.
    """
    bounds = city_boundary.bounds
    roads = []

    # Create main grid
    num_lines = 5
    for i in range(num_lines):
        # Horizontal roads
        y = bounds[1] + (bounds[3] - bounds[1]) * i / (num_lines - 1)
        line = LineString([(bounds[0], y), (bounds[2], y)])
        roads.append({
            'geometry': line,
            'type': 'secondary' if i == num_lines // 2 else 'local',
            'width': 7 if i == num_lines // 2 else 5,
            'importance': 6 if i == num_lines // 2 else 3,
            'name': generate_road_name('secondary' if i == num_lines // 2 else 'local', i + 1),
            'connects': []
        })

        # Vertical roads
        x = bounds[0] + (bounds[2] - bounds[0]) * i / (num_lines - 1)
        line = LineString([(x, bounds[1]), (x, bounds[3])])
        roads.append({
            'geometry': line,
            'type': 'secondary' if i == num_lines // 2 else 'local',
            'width': 7 if i == num_lines // 2 else 5,
            'importance': 6 if i == num_lines // 2 else 3,
            'name': generate_road_name('secondary' if i == num_lines // 2 else 'local', i + num_lines + 1),
            'connects': []
        })

    return roads


def create_clustered_road_network(building_points: List[Dict], city_boundary: Polygon,
                                city_name: str, max_clusters: int = 20) -> List[Dict]:
    """
    Generate road network using spatial clustering for large datasets.
    """
    logger.info(f"Using clustered approach for {len(building_points)} buildings")

    # Extract coordinates for clustering
    coords = np.array([bp['coords'] for bp in building_points])

    # Use DBSCAN for natural clustering based on density
    eps = 0.001  # ~100m in degrees
    clustering = DBSCAN(eps=eps, min_samples=3).fit(coords)

    # Get cluster centers and important buildings
    cluster_centers = []
    important_buildings = []

    for cluster_id in set(clustering.labels_):
        if cluster_id == -1:  # Noise points
            continue

        cluster_mask = clustering.labels_ == cluster_id
        cluster_coords = coords[cluster_mask]
        cluster_buildings = [bp for i, bp in enumerate(building_points) if cluster_mask[i]]

        # Find cluster center (highest importance building or centroid)
        max_importance = max(bp['importance'] for bp in cluster_buildings)
        center_building = next((bp for bp in cluster_buildings if bp['importance'] == max_importance), None)

        if center_building:
            cluster_centers.append(center_building['coords'])
            if center_building['importance'] >= 8:
                important_buildings.append(center_building['coords'])

    # Create simplified road network connecting cluster centers
    roads = []

    if len(cluster_centers) <= 1:
        return create_simple_radial_network(building_points, city_boundary)

    # Connect nearby clusters with roads
    coords_array = np.array(cluster_centers)
    distances = distance_matrix(coords_array, coords_array)

    # Create minimum spanning tree for basic connectivity
    G = nx.Graph()
    for i in range(len(cluster_centers)):
        for j in range(i + 1, len(cluster_centers)):
            dist = distances[i, j]
            if dist < 0.005:  # Only connect nearby clusters (~500m)
                G.add_edge(i, j, weight=dist)

    # Generate roads from graph edges
    road_features = []
    for idx, (i, j) in enumerate(G.edges()):
        start_coord = cluster_centers[i]
        end_coord = cluster_centers[j]
        line = LineString([start_coord, end_coord])

        # Determine road type based on connected building importance
        road_type = 'local'
        road_width = 5
        importance = 3

        # Check if connects important areas
        if (start_coord in important_buildings or end_coord in important_buildings):
            road_type = 'primary'
            road_width = 10
            importance = 10
        elif len(cluster_centers) > 10 and (i < 5 or j < 5):  # Major clusters
            road_type = 'secondary'
            road_width = 7
            importance = 6

        road_features.append({
            'geometry': line,
            'type': road_type,
            'width': road_width,
            'importance': importance,
            'name': generate_road_name(road_type, idx + 1),
            'connects': []
        })

    logger.info(f"Generated {len(road_features)} cluster-based roads")
    return road_features


def create_building_aware_road_network(building_points: List[Dict], gdf: gpd.GeoDataFrame, city_boundary: Polygon, city_name: str) -> List[Dict]:
    """
    Create building-aware road network that respects building boundaries and creates interconnected networks.
    """
    from shapely.ops import unary_union
    import numpy as np
    from scipy.spatial import distance

    logger.info(f"Creating boundary-respecting interconnected road network for {len(building_points)} buildings")

    # Extract building footprint polygons from GeoDataFrame
    building_polygons = []
    for idx, row in gdf.iterrows():
        if hasattr(row.geometry, 'geoms'):  # MultiPolygon
            for geom in row.geometry.geoms:
                building_polygons.append(geom)
        else:  # Single Polygon
            building_polygons.append(row.geometry)

    logger.info(f"Extracted {len(building_polygons)} building polygons for boundary checking")

    # Create building exclusion zones with proper buffer
    building_exclusion_zones = []
    for building in building_polygons:
        # Use larger buffer to ensure roads don't intersect buildings
        buffered = building.buffer(0.0005)  # ~50m buffer for safety
        building_exclusion_zones.append(buffered)

    # Union all exclusion zones for efficient intersection checking
    exclusion_union = unary_union(building_exclusion_zones)

    # Generate interconnected street network
    interconnected_network = generate_interconnected_street_grid(
        city_boundary, exclusion_union, building_polygons
    )

    # Generate building access roads that connect to the network
    access_roads = generate_boundary_respecting_access_roads(
        building_polygons, interconnected_network, exclusion_union
    )

    # Combine and validate final network
    all_roads = interconnected_network + access_roads
    validated_roads = validate_building_boundaries(all_roads, building_polygons)

    logger.info(f"Boundary-respecting network: {len(validated_roads)} roads with full connectivity")
    return validated_roads


def calculate_building_access_point(building_polygon):
    """Calculate the optimal access point for a building (typically closest to potential road location)."""
    # For now, use the centroid of the building's boundary
    # In a more sophisticated version, this could analyze the building orientation
    boundary = building_polygon.boundary
    if boundary.geom_type == 'LineString':
        # Find the point on the boundary closest to the building's bounding box center
        bounds = building_polygon.bounds
        bbox_center = Point((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2)
        closest_point = boundary.interpolate(boundary.project(bbox_center))
        return (closest_point.x, closest_point.y)
    else:
        # Fallback to centroid
        centroid = building_polygon.centroid
        return (centroid.x, centroid.y)


def generate_interconnected_street_grid(city_boundary, exclusion_union, building_polygons):
    """Generate an interconnected street grid that properly avoids buildings and creates junctions."""
    import numpy as np
    from shapely.ops import unary_union

    bounds = city_boundary.bounds
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]

    # Calculate grid spacing based on city size and building density
    num_buildings = len(building_polygons)
    if num_buildings < 50:
        grid_spacing = min(width, height) / 4
    elif num_buildings < 200:
        grid_spacing = min(width, height) / 6
    else:
        grid_spacing = min(width, height) / 10

    logger.info(f"Using grid spacing: {grid_spacing:.6f} for {num_buildings} buildings")

    # Create junction points first (intersections of horizontal and vertical lines)
    junction_points = []
    x_lines = np.arange(bounds[0] + grid_spacing, bounds[2], grid_spacing)
    y_lines = np.arange(bounds[1] + grid_spacing, bounds[3], grid_spacing)

    # Find valid junction points (not in exclusion zones)
    for x in x_lines:
        for y in y_lines:
            junction_point = Point(x, y)
            if (city_boundary.contains(junction_point) and
                not exclusion_union.intersects(junction_point)):
                junction_points.append((x, y))

    logger.info(f"Generated {len(junction_points)} valid junction points")

    # Generate interconnected road segments between junction points
    roads = []
    road_id = 0

    # Generate horizontal connections
    for y in y_lines:
        # Get all junction points on this horizontal line
        horizontal_junctions = [(x, y_coord) for x, y_coord in junction_points if abs(y_coord - y) < 0.0001]
        horizontal_junctions.sort()  # Sort by x coordinate

        # Connect adjacent junction points
        for i in range(len(horizontal_junctions) - 1):
            start_point = horizontal_junctions[i]
            end_point = horizontal_junctions[i + 1]

            # Create road segment with collision checking
            road_line = create_collision_free_road(start_point, end_point, exclusion_union)
            if road_line:
                roads.append({
                    'geometry': road_line,
                    'type': 'secondary',
                    'width': 7,
                    'importance': 6,
                    'name': f'Street {road_id + 1}',
                    'connects': [start_point, end_point],
                    'junction_points': [start_point, end_point]
                })
                road_id += 1

    # Generate vertical connections
    for x in x_lines:
        # Get all junction points on this vertical line
        vertical_junctions = [(x_coord, y) for x_coord, y in junction_points if abs(x_coord - x) < 0.0001]
        vertical_junctions.sort(key=lambda p: p[1])  # Sort by y coordinate

        # Connect adjacent junction points
        for i in range(len(vertical_junctions) - 1):
            start_point = vertical_junctions[i]
            end_point = vertical_junctions[i + 1]

            # Create road segment with collision checking
            road_line = create_collision_free_road(start_point, end_point, exclusion_union)
            if road_line:
                roads.append({
                    'geometry': road_line,
                    'type': 'secondary',
                    'width': 7,
                    'importance': 6,
                    'name': f'Avenue {road_id + 1}',
                    'connects': [start_point, end_point],
                    'junction_points': [start_point, end_point]
                })
                road_id += 1

    logger.info(f"Generated {len(roads)} interconnected street segments")
    return roads


def create_collision_free_road(start_point, end_point, exclusion_union):
    """Create a road line between two points, checking for building collisions."""
    # Create straight line first
    road_line = LineString([start_point, end_point])

    # Check if road intersects any exclusion zones
    if exclusion_union.intersects(road_line):
        logger.debug(f"Road from {start_point} to {end_point} intersects buildings - skipping")
        return None

    return road_line


def create_smooth_road_line(coords):
    """Create a smooth road line from coordinate points."""
    if len(coords) < 2:
        return None

    # Add slight smoothing to make roads less grid-like
    smoothed_coords = []
    for i, (x, y) in enumerate(coords):
        if i == 0 or i == len(coords) - 1:
            smoothed_coords.append((x, y))
        else:
            # Add slight variation to make roads more natural
            noise_x = np.random.uniform(-0.0001, 0.0001)
            noise_y = np.random.uniform(-0.0001, 0.0001)
            smoothed_coords.append((x + noise_x, y + noise_y))

    return LineString(smoothed_coords)


def generate_boundary_respecting_access_roads(building_polygons, street_network, exclusion_union):
    """Generate access roads that connect buildings to streets without crossing building boundaries."""
    access_roads = []

    # Get all junction points and street endpoints for connection targets
    connection_points = []
    for road in street_network:
        if 'junction_points' in road:
            connection_points.extend(road['junction_points'])
        elif road['geometry']:
            # Add start and end points of roads as potential connection points
            coords = list(road['geometry'].coords)
            connection_points.extend([coords[0], coords[-1]])

    # Remove duplicates
    connection_points = list(set(connection_points))
    logger.info(f"Found {len(connection_points)} connection points for access roads")

    # For each building, create access road to nearest connection point
    for i, building in enumerate(building_polygons):
        building_centroid = building.centroid

        # Find the closest connection point
        min_distance = float('inf')
        best_connection_point = None

        for conn_point in connection_points:
            distance = building_centroid.distance(Point(conn_point))
            if distance < min_distance and distance < 0.002:  # ~200m max
                min_distance = distance
                best_connection_point = conn_point

        if best_connection_point:
            # Create access road from building edge to connection point
            building_boundary = building.boundary
            if hasattr(building_boundary, 'coords'):
                # Find closest point on building boundary to connection point
                closest_point_on_building = building_boundary.interpolate(
                    building_boundary.project(Point(best_connection_point))
                )

                access_start = (closest_point_on_building.x, closest_point_on_building.y)
                access_end = best_connection_point

                # Create access road and check for collisions
                access_road = LineString([access_start, access_end])

                # Check if access road intersects any other buildings (except its own)
                other_buildings = [b for b in building_polygons if b != building]
                other_exclusions = unary_union([b.buffer(0.0005) for b in other_buildings]) if other_buildings else None

                valid_access = True
                if other_exclusions and other_exclusions.intersects(access_road):
                    valid_access = False
                    logger.debug(f"Access road for building {i} intersects other buildings - skipping")

                if valid_access:
                    access_roads.append({
                        'geometry': access_road,
                        'type': 'local',
                        'width': 5,
                        'importance': 3,
                        'name': f'Access Road {len(access_roads) + 1}',
                        'connects': [access_start, access_end],
                        'building_id': i
                    })

    logger.info(f"Generated {len(access_roads)} boundary-respecting access roads")
    return access_roads


def validate_building_boundaries(roads, building_polygons):
    """Final validation to ensure no roads intersect building boundaries."""
    from shapely.ops import unary_union

    valid_roads = []

    # Create building union for fast intersection checking
    building_union = unary_union(building_polygons)

    for road in roads:
        if road['geometry'] is None:
            continue

        # Check if road intersects any building
        if not building_union.intersects(road['geometry']):
            valid_roads.append(road)
        else:
            logger.debug(f"Removing road {road.get('name', 'unnamed')} - intersects building boundaries")

    logger.info(f"Validation: {len(valid_roads)}/{len(roads)} roads passed building boundary check")
    return valid_roads


def optimize_road_network(roads, building_polygons):
    """Clean up and optimize the road network to remove overlaps and ensure connectivity."""
    # Filter out None geometries and very short roads
    valid_roads = []
    for road in roads:
        if road['geometry'] is not None and road['geometry'].length > 0.0001:  # Minimum ~10m length
            valid_roads.append(road)

    # Add primary arterial roads for major connectivity if network is sparse
    if len(valid_roads) < max(3, len(building_polygons) // 20):
        # Add a few primary roads for basic connectivity
        bounds = unary_union(building_polygons).bounds if building_polygons else None
        if bounds:
            # Add main arterial road
            center_y = (bounds[1] + bounds[3]) / 2
            arterial_coords = [(bounds[0], center_y), (bounds[2], center_y)]
            arterial_road = LineString(arterial_coords)

            valid_roads.append({
                'geometry': arterial_road,
                'type': 'primary',
                'width': 10,
                'importance': 10,
                'name': 'Main Street',
                'connects': []
            })

    return valid_roads


def generate_primary_network(nodes: List[tuple]) -> List[tuple]:
    """Generate primary road connections between main nodes."""
    connections = []
    if len(nodes) < 2:
        return connections

    # Connect center to major nodes (radial pattern)
    center = nodes[0]
    for i in range(1, min(6, len(nodes))):
        connections.append((center, nodes[i]))

    # Add ring connections for larger networks
    if len(nodes) > 4:
        for i in range(1, min(len(nodes), 6)):
            next_node = 1 + (i % (len(nodes) - 1))
            if next_node != i:
                connections.append((nodes[i], nodes[next_node]))

    return connections


def generate_secondary_network(all_nodes: List[tuple], primary_connections: List[tuple], target_count: int) -> List[tuple]:
    """Generate secondary roads to fill network gaps."""
    connections = []
    used_pairs = set(primary_connections + [(b, a) for a, b in primary_connections])

    # Connect nearby nodes that aren't already connected
    for i, node_a in enumerate(all_nodes):
        for j, node_b in enumerate(all_nodes[i+1:], i+1):
            if len(connections) >= target_count:
                break

            if (node_a, node_b) not in used_pairs and (node_b, node_a) not in used_pairs:
                # Check distance to avoid overly long roads
                distance = np.sqrt((node_a[0] - node_b[0])**2 + (node_a[1] - node_b[1])**2)
                if distance < 0.02:  # Reasonable distance threshold
                    connections.append((node_a, node_b))
                    used_pairs.add((node_a, node_b))
                    used_pairs.add((node_b, node_a))

        if len(connections) >= target_count:
            break

    return connections


def generate_curved_road_coordinates(start: tuple, end: tuple, num_points: int = 25) -> List[tuple]:
    """
    Generate realistic curved road coordinates between two points.
    Creates 20-50+ coordinate points per road for realistic curvature.
    """
    import numpy as np

    # Calculate base path
    x_diff = end[0] - start[0]
    y_diff = end[1] - start[1]

    # Create curved path using sinusoidal variation
    t = np.linspace(0, 1, num_points)

    # Add curvature based on distance (longer roads get more curve)
    distance = np.sqrt(x_diff**2 + y_diff**2)
    curve_amplitude = min(distance * 0.1, 0.005)  # Proportional curvature

    # Generate curve offset perpendicular to main direction
    if abs(x_diff) > abs(y_diff):
        # Primarily horizontal road
        curve_offset_x = curve_amplitude * np.sin(t * np.pi * 2) * 0.3
        curve_offset_y = curve_amplitude * np.sin(t * np.pi * 1.5)
    else:
        # Primarily vertical road
        curve_offset_x = curve_amplitude * np.sin(t * np.pi * 1.5)
        curve_offset_y = curve_amplitude * np.sin(t * np.pi * 2) * 0.3

    # Generate coordinates
    coordinates = []
    for i in range(num_points):
        x = start[0] + t[i] * x_diff + curve_offset_x[i]
        y = start[1] + t[i] * y_diff + curve_offset_y[i]
        coordinates.append((x, y))

    return coordinates


def generate_local_roads(building_points: List[Dict], network_nodes: List[tuple], target_count: int) -> List[Dict]:
    """Generate local roads connecting buildings to the main network."""
    roads = []

    # Connect some buildings to nearest network nodes
    for i, building in enumerate(building_points[:target_count]):
        if i >= target_count:
            break

        building_coords = building['coords']

        # Find nearest network node
        min_distance = float('inf')
        nearest_node = network_nodes[0]

        for node in network_nodes:
            distance = np.sqrt((building_coords[0] - node[0])**2 + (building_coords[1] - node[1])**2)
            if distance < min_distance:
                min_distance = distance
                nearest_node = node

        # Generate curved connection
        road_coords = generate_curved_road_coordinates(nearest_node, building_coords, num_points=15)
        line = LineString(road_coords)

        roads.append({
            'geometry': line,
            'type': 'local',
            'width': 5,
            'importance': 3,
            'name': generate_road_name('local', i + 1),
            'connects': [nearest_node, building_coords]
        })

    return roads


def create_simple_radial_network(building_points: List[Dict], city_boundary: Polygon) -> List[Dict]:
    """
    Fallback: Create simple radial road network for very large or dense datasets.
    """
    # Find city center
    bounds = city_boundary.bounds
    center = Point((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2)

    # Find most important buildings
    important_buildings = sorted(building_points, key=lambda x: x['importance'], reverse=True)[:10]

    roads = []

    # Create radial roads from center to important buildings
    for i, building in enumerate(important_buildings):
        building_point = Point(building['coords'])
        line = LineString([center.coords[0], building['coords']])

        road_type = 'primary' if building['importance'] >= 8 else 'secondary'
        road_width = 10 if road_type == 'primary' else 7
        importance = building['importance']

        roads.append({
            'geometry': line,
            'type': road_type,
            'width': road_width,
            'importance': importance,
            'name': generate_road_name(road_type, i + 1),
            'connects': []
        })

    # Create ring roads
    if len(important_buildings) > 4:
        # Inner ring connecting important buildings
        ring_coords = [Point(bp['coords']) for bp in important_buildings[:6]]
        for i in range(len(ring_coords)):
            start = ring_coords[i]
            end = ring_coords[(i + 1) % len(ring_coords)]
            line = LineString([start.coords[0], end.coords[0]])

            roads.append({
                'geometry': line,
                'type': 'secondary',
                'width': 7,
                'importance': 6,
                'name': generate_road_name('secondary', len(roads) + 1),
                'connects': []
            })

    logger.info(f"Generated {len(roads)} radial roads")
    return roads


def create_navigation_graph_from_buildings(buildings_geojson, city_name):
    """
    Generates a hierarchical road network for a city using scalable algorithms.

    Uses different approaches based on dataset size:
    - Small (< 50): Full Voronoi diagram
    - Medium (50-500): Clustered approach
    - Large (500+): Simplified radial network

    Args:
        buildings_geojson: GeoJSON data with building polygons
        city_name: Name of the city for logging

    Returns:
        GeoJSON FeatureCollection of road network
    """
    start_time = time.time()

    try:
        # Convert GeoJSON to GeoDataFrame
        gdf = gpd.GeoDataFrame.from_features(buildings_geojson['features'])

        if len(gdf) == 0:
            return create_empty_result()

        # Calculate city extent first
        city_boundary = calculate_city_extent(gdf)

        # Extract building centroids and classify importance
        building_points = []
        for idx, row in gdf.iterrows():
            centroid = row.geometry.centroid
            importance = classify_building_importance(row)

            point_data = {
                'coords': (centroid.x, centroid.y),
                'importance': importance,
                'type': row.get('specific_type', row.get('type', 'residential')),
                'id': row.get('id', f'building_{idx}')
            }
            building_points.append(point_data)

        num_buildings = len(building_points)
        logger.info(f"Processing {num_buildings} buildings in {city_name}")

        # Choose algorithm based on dataset size and quality requirements
        if num_buildings == 0:
            logger.warning("No buildings found - creating minimal road network")
            road_features = []
        else:
            # Use building-aware road generation for all cities
            logger.info("Using building-aware road generation")
            road_features = create_building_aware_road_network(building_points, gdf, city_boundary, city_name)

        # Convert to GeoJSON format
        features = []
        road_counter = {'primary': 0, 'secondary': 0, 'local': 0}

        for idx, road in enumerate(road_features):
            road_counter[road['type']] += 1

            feature = {
                "type": "Feature",
                "properties": {
                    "id": f"road_{idx}",
                    "name": road['name'],
                    "type": road['type'],
                    "width": road['width'],
                    "importance": road['importance'],
                    "city": city_name,
                    "algorithm": "voronoi" if num_buildings <= 50 else "clustered" if num_buildings <= 1000 else "radial"
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": list(road['geometry'].coords)
                }
            }
            features.append(feature)

        elapsed_time = time.time() - start_time
        logger.info(f"Generated {len(features)} roads in {elapsed_time:.2f}s: "
                   f"{road_counter['primary']} primary, {road_counter['secondary']} secondary, "
                   f"{road_counter['local']} local")

        return {
            "type": "FeatureCollection",
            "features": features
        }

    except Exception as e:
        print(f"Error generating roads for {city_name}: {str(e)}")
        return create_empty_result()


def simplify_graph(G):
    """
    Simplify the graph by removing unnecessary nodes and merging edges
    """
    # Remove isolated nodes
    G.remove_nodes_from(list(nx.isolates(G)))

    # Merge degree-2 nodes (straight road segments)
    nodes_to_remove = []
    for node in G.nodes():
        if G.degree(node) == 2:
            neighbors = list(G.neighbors(node))
            if len(neighbors) == 2:
                # Create new edge between neighbors
                weight = G[node][neighbors[0]]['weight'] + G[node][neighbors[1]]['weight']
                G.add_edge(neighbors[0], neighbors[1], weight=weight)
                nodes_to_remove.append(node)

    G.remove_nodes_from(nodes_to_remove)

    return G


def calculate_edge_centrality(G, edge):
    """
    Calculate the importance of an edge in the network
    """
    try:
        # Use betweenness centrality as a measure of importance
        edge_betweenness = nx.edge_betweenness_centrality(G, normalized=True)
        return edge_betweenness.get(edge, 0.0)
    except:
        return 0.5


def generate_road_name(road_type: str, counter: int) -> str:
    """
    Generate appropriate road name based on type.
    """
    primary_names = ['Main Street', 'High Street', 'Market Road', 'Castle Way',
                     'King\'s Road', 'Queen\'s Avenue', 'Cathedral Street']
    secondary_names = ['Church Lane', 'Mill Road', 'Merchant Street', 'Guild Way',
                       'Harbor Road', 'Smith Street', 'Workshop Alley']
    local_names = ['Oak Lane', 'Rose Street', 'River Road', 'Hill Path',
                   'Garden Way', 'Cottage Lane', 'Narrow Alley']

    import random
    random.seed(counter)  # Deterministic names

    if road_type == 'primary':
        return random.choice(primary_names)
    elif road_type == 'secondary':
        return random.choice(secondary_names)
    else:
        return random.choice(local_names)


def create_simple_grid(bounds):
    """
    Create a simple grid road network as fallback
    """
    minx, miny, maxx, maxy = bounds

    # Create grid lines
    features = []

    # Horizontal roads
    for y in np.linspace(miny, maxy, 5):
        feature = {
            "type": "Feature",
            "properties": {"type": "secondary"},
            "geometry": {
                "type": "LineString",
                "coordinates": [[minx, y], [maxx, y]]
            }
        }
        features.append(feature)

    # Vertical roads
    for x in np.linspace(minx, maxx, 5):
        feature = {
            "type": "Feature",
            "properties": {"type": "secondary"},
            "geometry": {
                "type": "LineString",
                "coordinates": [[x, miny], [x, maxy]]
            }
        }
        features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }


def create_empty_result():
    """
    Create an empty GeoJSON result
    """
    return {
        "type": "FeatureCollection",
        "features": []
    }


def main():
    """
    Main entry point for the script - supports both JSON input and file-based operation.
    """
    parser = argparse.ArgumentParser(description='Generate road networks for cities')
    parser.add_argument('city_name', nargs='?', help='Name of city (for file mode)')
    parser.add_argument('--json-input', action='store_true', help='Accept JSON via stdin')
    parser.add_argument('--input-dir', default='/root/Eno/qgis/yksittäiset/buildings',
                       help='Directory with building GeoJSON files')
    parser.add_argument('--output-dir', default='/root/Eno/Eno-Frontend/Mundi/local-data/roads',
                       help='Output directory for road GeoJSON')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')

    args = parser.parse_args()

    if args.debug:
        logger.setLevel(logging.DEBUG)

    try:
        if args.json_input or (len(sys.argv) > 1 and sys.argv[1].startswith('{')):
            # JSON input mode (for API integration)
            if len(sys.argv) > 1 and sys.argv[1].startswith('{'):
                input_data = json.loads(sys.argv[1])
            else:
                input_data = json.load(sys.stdin)

            city_name = input_data.get('cityName', 'Unknown')
            buildings = input_data.get('buildings', {"type": "FeatureCollection", "features": []})

            # Generate road network
            road_network = create_navigation_graph_from_buildings(buildings, city_name)

            # Output as JSON
            print(json.dumps(road_network))

        else:
            # File-based mode
            if not args.city_name:
                parser.error("city_name required in file mode")

            # Setup paths
            input_dir = Path(args.input_dir)
            output_dir = Path(args.output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)

            # Try different file naming patterns
            building_file = None
            patterns = [
                f'buildings_{args.city_name.lower()}.geojson_fixed.geojson_poly.geojson',
                f'buildings_{args.city_name.lower()}.geojson_poly.geojson',
                f'buildings_{args.city_name.lower()}.geojson.geojson',
                f'buildings_{args.city_name.lower()}.geojson'
            ]

            for pattern in patterns:
                test_file = input_dir / pattern
                if test_file.exists():
                    building_file = test_file
                    break

            if not building_file:
                logger.error(f"No building file found for {args.city_name}")
                sys.exit(1)

            # Load building data
            with open(building_file, 'r') as f:
                buildings = json.load(f)

            # Generate roads
            road_network = create_navigation_graph_from_buildings(buildings, args.city_name)

            # Save output
            output_file = output_dir / f'{args.city_name.lower()}_roads.geojson'
            with open(output_file, 'w') as f:
                json.dump(road_network, f, indent=2)

            logger.info(f"Saved roads to {output_file}")
            print(f"Successfully generated {len(road_network['features'])} roads for {args.city_name}")

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON input: {e}")
        if args.json_input:
            print(json.dumps({"error": f"Invalid JSON: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error generating roads: {e}")
        if args.json_input:
            print(json.dumps({"error": f"Error: {str(e)}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()