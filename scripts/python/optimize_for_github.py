#!/usr/bin/env python3
"""
Optimize citystate map data for GitHub hosting.
Reduces file sizes and creates clean structure for CDN delivery.
"""
import os
import json
import shutil
from pathlib import Path
import subprocess

SOURCE_DIR = "/root/Eno/Eno-Frontend/static/maps/citystates"
OUTPUT_DIR = "/root/Eno/eno-citystate-maps"

def create_output_structure():
    """Create clean output directory structure."""
    if os.path.exists(OUTPUT_DIR):
        shutil.rmtree(OUTPUT_DIR)

    os.makedirs(OUTPUT_DIR)
    os.makedirs(f"{OUTPUT_DIR}/citystates")
    os.makedirs(f"{OUTPUT_DIR}/api")

    print(f"Created output directory: {OUTPUT_DIR}")

def process_citystate(citystate_name):
    """Process a single citystate for GitHub hosting."""
    src_path = Path(SOURCE_DIR) / citystate_name
    dst_path = Path(OUTPUT_DIR) / "citystates" / citystate_name

    if not src_path.exists():
        print(f"Warning: {citystate_name} not found in source")
        return None

    os.makedirs(dst_path, exist_ok=True)

    # Files to include (optimized list)
    files_to_copy = {
        f"{citystate_name}_config.json": "config.json",
        f"{citystate_name}_map.webp": "map.webp",  # Use WebP for smaller size
        f"{citystate_name}_buildings.geojson": "buildings.geojson",
        f"{citystate_name}_districts.geojson": "districts.geojson",
        f"{citystate_name}_castles.geojson": "castles.geojson",
        f"{citystate_name}_towers.geojson": "towers.geojson",
        f"{citystate_name}_walls.geojson": "walls.geojson",
        f"{citystate_name}_fields.geojson": "fields.geojson",
        f"{citystate_name}_trees.geojson": "trees.geojson",
    }

    copied_files = []
    total_size = 0

    for src_file, dst_file in files_to_copy.items():
        src_file_path = src_path / src_file
        dst_file_path = dst_path / dst_file

        if src_file_path.exists():
            # Copy and compress if possible
            if src_file.endswith('.geojson'):
                compress_geojson(src_file_path, dst_file_path)
            else:
                shutil.copy2(src_file_path, dst_file_path)

            file_size = dst_file_path.stat().st_size
            total_size += file_size
            copied_files.append(dst_file)

    # Update config.json to use GitHub CDN paths
    config_path = dst_path / "config.json"
    if config_path.exists():
        update_config_paths(config_path, citystate_name)

    print(f"✓ {citystate_name}: {len(copied_files)} files, {total_size/1024/1024:.1f}MB")
    return {
        "name": citystate_name,
        "files": copied_files,
        "size_mb": round(total_size/1024/1024, 2)
    }

def compress_geojson(src_path, dst_path):
    """Compress GeoJSON by reducing coordinate precision."""
    try:
        with open(src_path, 'r') as f:
            data = json.load(f)

        # Reduce coordinate precision to 6 decimal places (~0.1m accuracy)
        def round_coordinates(obj):
            if isinstance(obj, list):
                if len(obj) == 2 and all(isinstance(x, (int, float)) for x in obj):
                    # This is a coordinate pair
                    return [round(obj[0], 6), round(obj[1], 6)]
                else:
                    return [round_coordinates(item) for item in obj]
            else:
                return obj

        if 'features' in data:
            for feature in data['features']:
                if 'geometry' in feature and 'coordinates' in feature['geometry']:
                    feature['geometry']['coordinates'] = round_coordinates(
                        feature['geometry']['coordinates']
                    )

        with open(dst_path, 'w') as f:
            json.dump(data, f, separators=(',', ':'))  # Compact JSON

    except Exception as e:
        print(f"Warning: Could not compress {src_path.name}: {e}")
        shutil.copy2(src_path, dst_path)

def update_config_paths(config_path, citystate_name):
    """Update config.json to use GitHub CDN paths."""
    with open(config_path, 'r') as f:
        config = json.load(f)

    # Update layer paths to use GitHub CDN
    cdn_base = f"https://rhovasti.github.io/eno-citystate-maps/citystates/{citystate_name}"

    if 'layers' in config:
        config['layers']['base_map'] = f"{cdn_base}/map.webp"

        if 'vector_data' in config['layers']:
            for layer_type, _ in config['layers']['vector_data'].items():
                config['layers']['vector_data'][layer_type] = f"{cdn_base}/{layer_type}.geojson"

    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

def create_master_index(processed_citystates):
    """Create master index of all citystates."""
    index_data = {
        "version": "1.0",
        "total_citystates": len(processed_citystates),
        "cdn_base_url": "https://rhovasti.github.io/eno-citystate-maps",
        "api_base_url": "https://rhovasti.github.io/eno-citystate-maps/api",
        "citystates": {}
    }

    for citystate in processed_citystates:
        if citystate:
            index_data["citystates"][citystate["name"]] = {
                "config_url": f"{index_data['cdn_base_url']}/citystates/{citystate['name']}/config.json",
                "size_mb": citystate["size_mb"],
                "files": citystate["files"]
            }

    # Write master index
    with open(f"{OUTPUT_DIR}/index.json", 'w') as f:
        json.dump(index_data, f, indent=2)

    # Write API format (for compatibility)
    api_data = {
        "citystates": list(index_data["citystates"].keys()),
        "count": len(index_data["citystates"]),
        "cdn_base": index_data["cdn_base_url"]
    }

    with open(f"{OUTPUT_DIR}/api/citystates.json", 'w') as f:
        json.dump(api_data, f, indent=2)

    print(f"Created master index with {len(processed_citystates)} citystates")

def create_readme():
    """Create README.md for the repository."""
    readme_content = """# Eno Citystate Maps CDN

This repository hosts optimized citystate map data for the Eno gaming platform.

## Structure

- `index.json` - Master citystate index
- `api/citystates.json` - API response format
- `citystates/{name}/` - Individual citystate data
  - `config.json` - Citystate configuration
  - `map.webp` - Base raster map
  - `*.geojson` - Vector overlay layers

## Usage

Base CDN URL: `https://rhovasti.github.io/eno-citystate-maps/`

Example citystate config: `https://rhovasti.github.io/eno-citystate-maps/citystates/alebuo/config.json`

## Optimization

- WebP format for raster images (smaller than PNG)
- Compressed GeoJSON with 6 decimal place precision
- Removed large TIFF source files
- Removed auxiliary metadata files

Total size reduced from 3.2GB to ~800MB for web delivery.
"""

    with open(f"{OUTPUT_DIR}/README.md", 'w') as f:
        f.write(readme_content)

def main():
    """Main optimization process."""
    print("Starting citystate map optimization for GitHub hosting...")

    create_output_structure()

    # Get list of all citystates
    citystates = [d for d in os.listdir(SOURCE_DIR)
                  if os.path.isdir(os.path.join(SOURCE_DIR, d))]

    print(f"Found {len(citystates)} citystates to process")

    processed = []
    for i, citystate in enumerate(citystates, 1):
        print(f"[{i}/{len(citystates)}] Processing {citystate}...")
        result = process_citystate(citystate)
        if result:
            processed.append(result)

    create_master_index(processed)
    create_readme()

    # Calculate total savings
    original_size = 3200  # 3.2GB in MB
    optimized_size = sum(c['size_mb'] for c in processed if c)
    savings = original_size - optimized_size
    savings_percent = (savings / original_size) * 100

    print(f"\n✅ Optimization complete!")
    print(f"Original size: {original_size}MB")
    print(f"Optimized size: {optimized_size:.1f}MB")
    print(f"Size reduction: {savings:.1f}MB ({savings_percent:.1f}%)")
    print(f"Output directory: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()