#!/usr/bin/env python3
"""
Connected Road Network Generation - Focus on Connectivity First

This approach prioritizes creating a connected road network by:
1. Building a primary backbone grid that spans the entire city
2. Connecting building clusters to the backbone
3. Adding local access roads
4. Ensuring all roads form a single connected network

The goal is to eliminate disconnected "sticks" and create realistic, navigable road networks.
"""

import geopandas as gpd
import os
import networkx as nx
from scipy.spatial import KDTree
from shapely.geometry import Point, LineString, Polygon, MultiPolygon
from shapely.ops import unary_union, nearest_points
import pandas as pd
import json
import numpy as np
from typing import List, Dict, Tuple, Optional
import time
from sklearn.cluster import DBSCAN


def create_city_backbone_grid(city_boundary: Polygon,
                             building_exclusions: List[Polygon],
                             city_name: str) -> List[LineString]:
    """
    Create a primary backbone grid that spans the entire city.
    This ensures we have a connected foundation to build upon.
    """
    print(f"Step 1: Creating backbone grid for {city_name}")

    # Get city bounds
    bounds = city_boundary.bounds
    min_x, min_y, max_x, max_y = bounds

    # Calculate grid spacing based on city size
    city_width = max_x - min_x
    city_height = max_y - min_y

    # Adaptive grid spacing - smaller cities get finer grids
    if city_width < 0.01:  # Small city (~1km)
        grid_spacing = 0.002  # ~200m
    else:  # Larger city
        grid_spacing = 0.004  # ~400m

    print(f"  - City bounds: {city_width:.4f} x {city_height:.4f}")
    print(f"  - Grid spacing: {grid_spacing:.4f}")

    backbone_lines = []
    exclusion_union = unary_union(building_exclusions) if building_exclusions else None

    # Create horizontal backbone roads
    y = min_y
    while y <= max_y:
        line = LineString([(min_x, y), (max_x, y)])

        # Clip to city boundary
        clipped = line.intersection(city_boundary)

        if clipped.geom_type == 'LineString':
            # Remove parts that intersect buildings
            if exclusion_union:
                final_line = clipped.difference(exclusion_union)
                if final_line.geom_type == 'LineString' and final_line.length > grid_spacing/2:
                    backbone_lines.append(final_line)
                elif final_line.geom_type == 'MultiLineString':
                    for sub_line in final_line.geoms:
                        if sub_line.length > grid_spacing/2:
                            backbone_lines.append(sub_line)
            else:
                backbone_lines.append(clipped)

        y += grid_spacing

    # Create vertical backbone roads
    x = min_x
    while x <= max_x:
        line = LineString([(x, min_y), (x, max_y)])

        # Clip to city boundary
        clipped = line.intersection(city_boundary)

        if clipped.geom_type == 'LineString':
            # Remove parts that intersect buildings
            if exclusion_union:
                final_line = clipped.difference(exclusion_union)
                if final_line.geom_type == 'LineString' and final_line.length > grid_spacing/2:
                    backbone_lines.append(final_line)
                elif final_line.geom_type == 'MultiLineString':
                    for sub_line in final_line.geoms:
                        if sub_line.length > grid_spacing/2:
                            backbone_lines.append(sub_line)
            else:
                backbone_lines.append(clipped)

        x += grid_spacing

    print(f"  - Generated {len(backbone_lines)} backbone segments")
    return backbone_lines


def connect_building_clusters(building_gdf: gpd.GeoDataFrame,
                            backbone_lines: List[LineString],
                            city_boundary: Polygon,
                            city_name: str) -> List[LineString]:
    """
    Connect building clusters to the backbone network.
    Uses DBSCAN clustering to identify building groups.
    """
    print(f"Step 2: Connecting building clusters for {city_name}")

    if building_gdf.empty:
        return []

    # Get building centroids
    centroids = []
    for geom in building_gdf.geometry:
        if geom is not None:
            centroid = geom.centroid
            if city_boundary.contains(centroid):
                centroids.append([centroid.x, centroid.y])

    if len(centroids) < 2:
        return []

    centroids = np.array(centroids)

    # Cluster buildings using DBSCAN
    # Adaptive epsilon based on city size
    city_size = city_boundary.bounds[2] - city_boundary.bounds[0]
    if city_size < 0.01:  # Small city
        eps = 0.001  # ~100m
        min_samples = 3
    else:  # Large city
        eps = 0.002  # ~200m
        min_samples = 5

    clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(centroids)
    labels = clustering.labels_

    unique_labels = set(labels)
    if -1 in unique_labels:
        unique_labels.remove(-1)  # Remove noise points

    print(f"  - Found {len(unique_labels)} building clusters")

    # Get cluster centers
    cluster_centers = []
    for label in unique_labels:
        cluster_points = centroids[labels == label]
        center = np.mean(cluster_points, axis=0)
        cluster_centers.append(Point(center[0], center[1]))

    # Create backbone network graph for finding nearest points
    backbone_points = []
    for line in backbone_lines:
        backbone_points.extend(list(line.coords))

    if not backbone_points:
        return []

    backbone_tree = KDTree(backbone_points)

    # Connect each cluster to nearest backbone point
    connector_lines = []
    for center in cluster_centers:
        # Find nearest backbone point
        dist, idx = backbone_tree.query([center.x, center.y])
        nearest_backbone = Point(backbone_points[idx])

        # Create connector road
        connector = LineString([center, nearest_backbone])

        # Only add if reasonable length and within city
        if connector.length < 0.005 and city_boundary.intersects(connector):  # Max ~500m
            connector_lines.append(connector)

    print(f"  - Generated {len(connector_lines)} cluster connectors")
    return connector_lines


def add_local_access_roads(building_gdf: gpd.GeoDataFrame,
                          existing_network: List[LineString],
                          city_boundary: Polygon,
                          city_name: str) -> List[LineString]:
    """
    Add local access roads to connect individual buildings to the main network.
    """
    print(f"Step 3: Adding local access roads for {city_name}")

    if not existing_network or building_gdf.empty:
        return []

    # Create network points for connection
    network_points = []
    for line in existing_network:
        # Sample points along the line, not just endpoints
        coords = list(line.coords)
        network_points.extend(coords)

        # Add midpoints for longer lines
        if len(coords) >= 2 and line.length > 0.001:
            for i in range(len(coords) - 1):
                midpoint = Point(
                    (coords[i][0] + coords[i+1][0]) / 2,
                    (coords[i][1] + coords[i+1][1]) / 2
                )
                network_points.append((midpoint.x, midpoint.y))

    if not network_points:
        return []

    network_tree = KDTree(network_points)

    # Connect buildings to nearest network point
    access_roads = []
    max_access_distance = 0.002  # ~200m max access road length

    for i, geom in enumerate(building_gdf.geometry):
        if geom is None:
            continue

        # Skip every other building to avoid too many access roads
        if i % 2 == 0:
            continue

        building_centroid = geom.centroid
        if not city_boundary.contains(building_centroid):
            continue

        # Find nearest network point
        dist, idx = network_tree.query([building_centroid.x, building_centroid.y])

        if dist < max_access_distance:
            nearest_network = Point(network_points[idx])
            access_road = LineString([building_centroid, nearest_network])

            # Check if access road is reasonable
            if (access_road.length > 0.0001 and  # Minimum length
                access_road.length < max_access_distance and
                city_boundary.intersects(access_road)):
                access_roads.append(access_road)

    print(f"  - Generated {len(access_roads)} access roads")
    return access_roads


def ensure_network_connectivity(all_lines: List[LineString],
                               city_boundary: Polygon,
                               city_name: str) -> List[LineString]:
    """
    Final step: ensure all roads form a connected network.
    Find isolated components and connect them.
    """
    print(f"Step 4: Ensuring network connectivity for {city_name}")

    if not all_lines:
        return []

    # Build NetworkX graph
    G = nx.Graph()
    node_coords_to_node = {}

    for line in all_lines:
        coords = list(line.coords)
        start_coord = coords[0]
        end_coord = coords[-1]

        start_node = node_coords_to_node.setdefault(start_coord, Point(start_coord))
        end_node = node_coords_to_node.setdefault(end_coord, Point(end_coord))

        G.add_edge(start_node, end_node, weight=line.length)

    # Find connected components
    components = list(nx.connected_components(G))
    print(f"  - Found {len(components)} connected components")

    if len(components) <= 1:
        print("  - Network already fully connected")
        return []

    # Connect components by finding shortest distances between them
    connector_roads = []
    max_connector_length = 0.003  # ~300m max connector

    # Get nodes from each component
    component_nodes = [list(comp) for comp in components]

    # Connect each component to the largest component
    largest_comp_idx = max(range(len(component_nodes)), key=lambda i: len(component_nodes[i]))
    largest_comp = component_nodes[largest_comp_idx]

    for i, comp_nodes in enumerate(component_nodes):
        if i == largest_comp_idx:
            continue

        # Find shortest connection between this component and largest component
        min_dist = float('inf')
        best_connection = None

        for node1 in comp_nodes:
            for node2 in largest_comp:
                dist = node1.distance(node2)
                if dist < min_dist and dist < max_connector_length:
                    min_dist = dist
                    best_connection = (node1, node2)

        # Create connector road
        if best_connection:
            connector = LineString([best_connection[0], best_connection[1]])
            if city_boundary.intersects(connector):
                connector_roads.append(connector)
                # Add this connector to the largest component for subsequent connections
                largest_comp.extend(comp_nodes)

    print(f"  - Generated {len(connector_roads)} connectivity bridges")
    return connector_roads


def connected_road_generation(city_name: str,
                             buildings_file: str,
                             output_file: str) -> Dict:
    """
    Main connected road generation function.
    Focuses on creating a connected network first, then adding details.
    """
    print(f"\n=== Connected Road Generation for {city_name} ===")
    start_time = time.time()

    # Load building data
    try:
        gdf = gpd.read_file(buildings_file)
        print(f"Loaded {len(gdf)} buildings from {buildings_file}")
    except Exception as e:
        print(f"Error loading buildings: {e}")
        return {'success': False, 'error': str(e)}

    if gdf.empty:
        print("No buildings found")
        return {'success': False, 'error': 'No buildings found'}

    # Create city boundary from building convex hull
    all_buildings_union = unary_union(gdf.geometry.dropna())
    city_boundary = all_buildings_union.convex_hull.buffer(0.002)  # ~200m buffer

    # Create building exclusion zones
    building_exclusions = []
    for geom in gdf.geometry:
        if geom is not None:
            buffered = geom.buffer(0.0003)  # ~30m buffer around buildings
            building_exclusions.append(buffered)

    # Step 1: Create backbone grid
    backbone_lines = create_city_backbone_grid(city_boundary, building_exclusions, city_name)

    # Step 2: Connect building clusters
    cluster_connectors = connect_building_clusters(gdf, backbone_lines, city_boundary, city_name)

    # Step 3: Add local access roads
    all_network_lines = backbone_lines + cluster_connectors
    access_roads = add_local_access_roads(gdf, all_network_lines, city_boundary, city_name)

    # Step 4: Ensure connectivity
    all_roads = backbone_lines + cluster_connectors + access_roads
    connectivity_bridges = ensure_network_connectivity(all_roads, city_boundary, city_name)

    # Combine all roads
    final_roads = backbone_lines + cluster_connectors + access_roads + connectivity_bridges

    if not final_roads:
        print("No roads generated")
        return {'success': False, 'error': 'No roads generated'}

    # Create GeoJSON output with road hierarchy
    features = []
    road_id = 0

    # Backbone roads (primary)
    for line in backbone_lines:
        features.append({
            "type": "Feature",
            "properties": {
                "id": f"backbone_{road_id}",
                "name": f"Main Street {road_id + 1}",
                "type": "primary",
                "width": 12,
                "importance": 9,
                "city": city_name,
                "algorithm": "connected_backbone"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": list(line.coords)
            }
        })
        road_id += 1

    # Cluster connectors (secondary)
    for line in cluster_connectors:
        features.append({
            "type": "Feature",
            "properties": {
                "id": f"cluster_{road_id}",
                "name": f"District Road {road_id + 1}",
                "type": "secondary",
                "width": 8,
                "importance": 7,
                "city": city_name,
                "algorithm": "connected_cluster"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": list(line.coords)
            }
        })
        road_id += 1

    # Access roads (tertiary)
    for line in access_roads:
        features.append({
            "type": "Feature",
            "properties": {
                "id": f"access_{road_id}",
                "name": f"Access Road {road_id + 1}",
                "type": "tertiary",
                "width": 6,
                "importance": 5,
                "city": city_name,
                "algorithm": "connected_access"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": list(line.coords)
            }
        })
        road_id += 1

    # Connectivity bridges (secondary)
    for line in connectivity_bridges:
        features.append({
            "type": "Feature",
            "properties": {
                "id": f"bridge_{road_id}",
                "name": f"Connector {road_id + 1}",
                "type": "secondary",
                "width": 8,
                "importance": 7,
                "city": city_name,
                "algorithm": "connected_bridge"
            },
            "geometry": {
                "type": "LineString",
                "coordinates": list(line.coords)
            }
        })
        road_id += 1

    geojson_output = {
        "type": "FeatureCollection",
        "features": features
    }

    # Save output
    with open(output_file, 'w') as f:
        json.dump(geojson_output, f, indent=2)

    end_time = time.time()

    result = {
        'success': True,
        'city': city_name,
        'roads_generated': len(final_roads),
        'processing_time': round(end_time - start_time, 2),
        'road_breakdown': {
            'backbone': len(backbone_lines),
            'cluster_connectors': len(cluster_connectors),
            'access_roads': len(access_roads),
            'connectivity_bridges': len(connectivity_bridges)
        },
        'output_file': output_file
    }

    print(f"\nConnected road generation complete:")
    print(f"  - {result['roads_generated']} total roads generated")
    print(f"  - Backbone roads: {result['road_breakdown']['backbone']}")
    print(f"  - Cluster connectors: {result['road_breakdown']['cluster_connectors']}")
    print(f"  - Access roads: {result['road_breakdown']['access_roads']}")
    print(f"  - Connectivity bridges: {result['road_breakdown']['connectivity_bridges']}")
    print(f"  - Processing time: {result['processing_time']}s")
    print(f"  - Output: {output_file}")

    return result


def test_connected_generation():
    """Test the connected road generation on sample cities."""
    test_cities = [
        {
            'name': 'citadel_of_utaia',
            'file': '/root/Eno/qgis/yksittäiset/buildings/buildings_citadel_of_utaia.geojson.geojson'
        },
        {
            'name': 'tsin',
            'file': '/root/Eno/qgis/yksittäiset/buildings/buildings_tsin.geojson_poly.geojson'
        }
    ]

    for city in test_cities:
        if os.path.exists(city['file']):
            output_file = f"/root/Eno/qgis/{city['name']}_connected_roads.geojson"
            result = connected_road_generation(city['name'], city['file'], output_file)

            if result['success']:
                print(f"\n✓ Successfully generated connected roads for {city['name']}")
            else:
                print(f"\n✗ Failed to generate roads for {city['name']}: {result.get('error')}")
        else:
            print(f"\n✗ Building file not found for {city['name']}: {city['file']}")


if __name__ == "__main__":
    test_connected_generation()