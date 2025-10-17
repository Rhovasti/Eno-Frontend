#!/usr/bin/env python3
"""
Sequential Pathfinder Road Generation - Adapted from qgis/yksittäiset/pathfinder approach

This script implements a 5-step sequential approach to generate realistic road networks:
1. Create Voronoi-based navigation graph from building vertices
2. Prune graph to remove segments intersecting buildings
3. Generate POI connections using A* pathfinding
4. Add grid-based local connectivity
5. Final cleanup and interconnection

The methodology ensures building boundary respect and realistic road connectivity.
"""

import geopandas as gpd
import os
import networkx as nx
from scipy.spatial import Voronoi, KDTree
from shapely.geometry import Point, LineString, Polygon, MultiPolygon
from shapely.ops import unary_union
import pandas as pd
import json
from typing import List, Dict, Tuple, Optional
import time


def get_building_vertices(gdf: gpd.GeoDataFrame) -> List[Tuple[float, float]]:
    """Extract all building corner vertices for Voronoi diagram."""
    points = []
    for geom in gdf.geometry:
        if geom is None:
            continue

        if hasattr(geom, 'geoms'):  # MultiPolygon
            for polygon in geom.geoms:
                if polygon.geom_type == 'Polygon':
                    points.extend(list(polygon.exterior.coords)[:-1])  # Exclude duplicate last point
        elif geom.geom_type == 'Polygon':
            points.extend(list(geom.exterior.coords)[:-1])  # Exclude duplicate last point

    # Remove duplicates and ensure we have enough points
    unique_points = list(set(points))
    print(f"  - Extracted {len(unique_points)} unique building vertices")
    return unique_points


def create_voronoi_navigation_graph(building_vertices: List[Tuple[float, float]],
                                  city_boundary: Polygon,
                                  city_name: str) -> List[LineString]:
    """
    Step 1: Create Voronoi-based navigation graph from building vertices.
    This creates potential street centerlines in empty spaces between buildings.
    """
    print(f"Step 1: Creating Voronoi navigation graph for {city_name}")

    if len(building_vertices) < 4:
        print("  - Not enough building vertices for Voronoi diagram")
        return []

    # Create Voronoi diagram
    print(f"  - Creating Voronoi diagram from {len(building_vertices)} vertices")
    vor = Voronoi(building_vertices)

    # Convert Voronoi ridges to LineStrings
    lines = []
    for ridge_vertices in vor.ridge_vertices:
        if -1 not in ridge_vertices:  # Skip infinite ridges
            p1 = vor.vertices[ridge_vertices[0]]
            p2 = vor.vertices[ridge_vertices[1]]
            line = LineString([Point(p1), Point(p2)])

            # Only include lines within city boundary (with small buffer for edge cases)
            if line.intersects(city_boundary.buffer(0.001)):
                # Clip line to city boundary
                clipped = line.intersection(city_boundary.buffer(0.001))
                if clipped.geom_type == 'LineString':
                    lines.append(clipped)
                elif clipped.geom_type == 'MultiLineString':
                    lines.extend(list(clipped.geoms))

    print(f"  - Generated {len(lines)} potential street segments from Voronoi")
    return lines


def prune_building_intersections(raw_lines: List[LineString],
                                building_gdf: gpd.GeoDataFrame,
                                city_name: str) -> List[LineString]:
    """
    Step 2: Remove any line segments that intersect with building footprints.
    Uses efficient spatial operations for collision detection.
    """
    print(f"Step 2: Pruning building intersections for {city_name}")

    if not raw_lines:
        print("  - No raw lines to prune")
        return []

    # Create GeoDataFrame from raw lines for spatial operations
    lines_gdf = gpd.GeoDataFrame(geometry=raw_lines, crs=building_gdf.crs)

    # Create building exclusion zones with small buffer
    building_exclusion = []
    for geom in building_gdf.geometry:
        if geom is not None:
            buffered = geom.buffer(0.0002)  # ~20m buffer for road clearance
            building_exclusion.append(buffered)

    if not building_exclusion:
        print("  - No building exclusions to apply")
        return raw_lines

    # Union all building exclusions for efficient intersection testing
    exclusion_union = unary_union(building_exclusion)

    # Filter out lines that intersect buildings
    valid_lines = []
    for line in raw_lines:
        if not line.intersects(exclusion_union):
            valid_lines.append(line)
        else:
            # Try to trim the line to avoid buildings
            difference = line.difference(exclusion_union)
            if difference.geom_type == 'LineString' and difference.length > 0.0001:
                valid_lines.append(difference)
            elif difference.geom_type == 'MultiLineString':
                for sub_line in difference.geoms:
                    if sub_line.length > 0.0001:
                        valid_lines.append(sub_line)

    print(f"  - Pruned from {len(raw_lines)} to {len(valid_lines)} valid segments")
    return valid_lines


def create_networkx_graph(line_segments: List[LineString]) -> nx.Graph:
    """Create NetworkX graph from line segments for pathfinding."""
    G = nx.Graph()
    node_coords_to_node = {}

    for line in line_segments:
        coords = list(line.coords)

        # Create or retrieve start and end nodes
        start_coord = coords[0]
        end_coord = coords[-1]

        start_node = node_coords_to_node.setdefault(start_coord, Point(start_coord))
        end_node = node_coords_to_node.setdefault(end_coord, Point(end_coord))

        # Add edge with weight as line length
        G.add_edge(start_node, end_node, weight=line.length, geometry=line)

    return G


def generate_poi_connections(pruned_lines: List[LineString],
                           building_gdf: gpd.GeoDataFrame,
                           city_boundary: Polygon,
                           city_name: str) -> List[Dict]:
    """
    Step 3: Generate connections to important Points of Interest.
    Uses A* pathfinding to create realistic routes.
    """
    print(f"Step 3: Generating POI connections for {city_name}")

    if not pruned_lines:
        print("  - No pruned lines available for POI connections")
        return []

    # Create NetworkX graph for pathfinding
    G = create_networkx_graph(pruned_lines)

    if G.number_of_nodes() < 2:
        print("  - Not enough nodes for pathfinding")
        return []

    # Get boundary points as potential gateways
    boundary_points = []
    boundary_coords = list(city_boundary.exterior.coords)
    # Sample every 10th point to avoid too many gateways
    for i in range(0, len(boundary_coords), max(1, len(boundary_coords) // 6)):
        boundary_points.append(Point(boundary_coords[i]))

    # Create POIs from building centroids (important buildings as destinations)
    building_centroids = []
    for i, geom in enumerate(building_gdf.geometry):
        if geom is not None and i % 5 == 0:  # Sample every 5th building as POI
            centroid = geom.centroid
            if city_boundary.contains(centroid):
                building_centroids.append(centroid)

    # Limit to avoid too many connections
    boundary_points = boundary_points[:4]  # Max 4 gateways
    building_centroids = building_centroids[:8]  # Max 8 POIs

    # Setup KDTree for nearest node finding
    node_list = list(G.nodes())
    kdtree = KDTree([(p.x, p.y) for p in node_list])

    # Generate A* paths
    road_data = []
    path_id = 0

    print(f"  - Finding paths from {len(boundary_points)} gateways to {len(building_centroids)} POIs")

    for gateway in boundary_points:
        # Find nearest graph node to gateway
        gateway_idx = kdtree.query([gateway.x, gateway.y])[1]
        start_node = node_list[gateway_idx]

        for poi in building_centroids:
            # Find nearest graph node to POI
            poi_idx = kdtree.query([poi.x, poi.y])[1]
            end_node = node_list[poi_idx]

            try:
                # A* pathfinding with euclidean distance heuristic
                def heuristic(u, v):
                    return u.distance(v)

                path_nodes = nx.astar_path(G, start_node, end_node,
                                         heuristic=heuristic, weight='weight')

                if len(path_nodes) >= 2:
                    path_geometry = LineString(path_nodes)
                    road_data.append({
                        'geometry': path_geometry,
                        'id': f'poi_path_{path_id}',
                        'name': f'Route {path_id + 1}',
                        'type': 'primary',
                        'width': 10,
                        'importance': 8,
                        'city': city_name,
                        'algorithm': 'pathfinder_poi'
                    })
                    path_id += 1

            except nx.NetworkXNoPath:
                continue  # Skip if no path found

    print(f"  - Generated {len(road_data)} POI connection routes")
    return road_data


def add_local_connectivity(pruned_lines: List[LineString],
                          existing_roads: List[Dict],
                          city_boundary: Polygon,
                          city_name: str) -> List[Dict]:
    """
    Step 4: Enhanced connectivity - connect nearby endpoints and bridge components.
    """
    print(f"Step 4: Adding enhanced connectivity for {city_name}")

    # Convert existing roads to lines for analysis
    existing_lines = [road['geometry'] for road in existing_roads]
    existing_lines.extend(pruned_lines)

    if not existing_lines:
        return []

    # Create NetworkX graph
    G = create_networkx_graph(existing_lines)
    node_list = list(G.nodes())

    if len(node_list) < 2:
        return []

    additional_roads = []
    road_id = len(existing_roads)

    # Method 1: Connect nearby endpoints
    print(f"  - Connecting nearby endpoints...")
    kdtree = KDTree([(p.x, p.y) for p in node_list])

    for node in node_list:
        # Find nodes within connection distance
        neighbors = kdtree.query_ball_point([node.x, node.y], r=0.0015)  # ~150m radius

        for neighbor_idx in neighbors:
            neighbor_node = node_list[neighbor_idx]

            # Skip self and already connected nodes
            if neighbor_node == node or G.has_edge(node, neighbor_node):
                continue

            # Create potential connection
            connection = LineString([node, neighbor_node])

            # Only add if reasonable and within city
            if (connection.length > 0.0002 and  # Min 20m
                connection.length < 0.0015 and  # Max 150m
                city_boundary.intersects(connection)):

                additional_roads.append({
                    'geometry': connection,
                    'id': f'endpoint_connector_{road_id}',
                    'name': f'Local Connector {road_id + 1}',
                    'type': 'tertiary',
                    'width': 5,
                    'importance': 4,
                    'city': city_name,
                    'algorithm': 'pathfinder_endpoint'
                })
                road_id += 1

                # Limit connections per node to avoid oversaturation
                if len([r for r in additional_roads if 'endpoint_connector' in r['id']]) >= len(node_list) // 3:
                    break

    # Method 2: Bridge isolated components
    print(f"  - Bridging isolated components...")

    # Rebuild graph with new connections for component analysis
    temp_lines = existing_lines + [road['geometry'] for road in additional_roads]
    temp_G = create_networkx_graph(temp_lines)
    components = list(nx.connected_components(temp_G))

    print(f"  - Found {len(components)} connected components after endpoint connections")

    if len(components) > 1:
        # Sort components by size (largest first)
        components = sorted(components, key=len, reverse=True)
        main_component = components[0]

        for comp in components[1:]:
            # Find shortest bridge between main component and this component
            min_dist = float('inf')
            best_bridge = None

            for node1 in list(main_component)[:20]:  # Limit search for performance
                for node2 in list(comp)[:20]:
                    dist = node1.distance(node2)
                    if dist < min_dist and dist < 0.003:  # Max 300m bridge
                        min_dist = dist
                        best_bridge = (node1, node2)

            # Create bridge
            if best_bridge:
                bridge_line = LineString([best_bridge[0], best_bridge[1]])
                if city_boundary.intersects(bridge_line):
                    additional_roads.append({
                        'geometry': bridge_line,
                        'id': f'component_bridge_{road_id}',
                        'name': f'Bridge {road_id + 1}',
                        'type': 'secondary',
                        'width': 6,
                        'importance': 5,
                        'city': city_name,
                        'algorithm': 'pathfinder_bridge'
                    })
                    road_id += 1

                    # Add bridged component to main component for next iterations
                    main_component.update(comp)

    print(f"  - Added {len(additional_roads)} connectivity roads")
    print(f"    - Endpoint connectors: {len([r for r in additional_roads if 'endpoint_connector' in r['id']])}")
    print(f"    - Component bridges: {len([r for r in additional_roads if 'component_bridge' in r['id']])}")

    return additional_roads


def pathfinder_road_generation(city_name: str,
                              buildings_file: str,
                              output_file: str) -> Dict:
    """
    Main pathfinder road generation function implementing the 5-step sequential approach.
    """
    print(f"\n=== Pathfinder Road Generation for {city_name} ===")
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

    # Step 1: Extract building vertices and create Voronoi graph
    building_vertices = get_building_vertices(gdf)
    if len(building_vertices) < 4:
        print("Insufficient building vertices for Voronoi generation")
        return {'success': False, 'error': 'Insufficient building vertices'}

    raw_voronoi_lines = create_voronoi_navigation_graph(building_vertices, city_boundary, city_name)

    # Step 2: Prune building intersections
    pruned_lines = prune_building_intersections(raw_voronoi_lines, gdf, city_name)

    # Step 3: Generate POI connections
    poi_roads = generate_poi_connections(pruned_lines, gdf, city_boundary, city_name)

    # Step 4: Add local connectivity
    connectivity_roads = add_local_connectivity(pruned_lines, poi_roads, city_boundary, city_name)

    # Step 5: Combine all roads and create final output
    all_roads = poi_roads + connectivity_roads

    # Add remaining pruned lines as local streets
    local_road_id = len(all_roads)
    for line in pruned_lines:
        # Skip if this line is already very close to existing roads
        too_close = False
        for existing_road in all_roads:
            if line.distance(existing_road['geometry']) < 0.0001:  # ~10m
                too_close = True
                break

        if not too_close and line.length > 0.0002:  # Minimum ~20m length
            all_roads.append({
                'geometry': line,
                'id': f'local_{local_road_id}',
                'name': f'Local Street {local_road_id + 1}',
                'type': 'secondary',
                'width': 6,
                'importance': 5,
                'city': city_name,
                'algorithm': 'pathfinder_local'
            })
            local_road_id += 1

    if not all_roads:
        print("No roads generated")
        return {'success': False, 'error': 'No roads generated'}

    # Create GeoJSON output
    features = []
    for i, road in enumerate(all_roads):
        feature = {
            "type": "Feature",
            "properties": {
                "id": road.get('id', f"road_{i}"),
                "name": road.get('name', f"Road {i + 1}"),
                "type": road.get('type', 'secondary'),
                "width": road.get('width', 7),
                "importance": road.get('importance', 6),
                "city": city_name,
                "algorithm": road.get('algorithm', 'pathfinder')
            },
            "geometry": {
                "type": "LineString",
                "coordinates": list(road['geometry'].coords)
            }
        }
        features.append(feature)

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
        'roads_generated': len(all_roads),
        'processing_time': round(end_time - start_time, 2),
        'algorithms_used': {
            'pathfinder_poi': len([r for r in all_roads if r.get('algorithm') == 'pathfinder_poi']),
            'pathfinder_connector': len([r for r in all_roads if r.get('algorithm') == 'pathfinder_connector']),
            'pathfinder_local': len([r for r in all_roads if r.get('algorithm') == 'pathfinder_local'])
        },
        'output_file': output_file
    }

    print(f"\nPathfinder generation complete:")
    print(f"  - {result['roads_generated']} roads generated")
    print(f"  - POI connections: {result['algorithms_used']['pathfinder_poi']}")
    print(f"  - Connectivity roads: {result['algorithms_used']['pathfinder_connector']}")
    print(f"  - Local streets: {result['algorithms_used']['pathfinder_local']}")
    print(f"  - Processing time: {result['processing_time']}s")
    print(f"  - Output: {output_file}")

    return result


def test_pathfinder_generation():
    """Test the pathfinder road generation on a sample city."""
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
            output_file = f"/root/Eno/qgis/{city['name']}_pathfinder_roads.geojson"
            result = pathfinder_road_generation(city['name'], city['file'], output_file)

            if result['success']:
                print(f"\n✓ Successfully generated roads for {city['name']}")
            else:
                print(f"\n✗ Failed to generate roads for {city['name']}: {result.get('error')}")
        else:
            print(f"\n✗ Building file not found for {city['name']}: {city['file']}")


if __name__ == "__main__":
    test_pathfinder_generation()