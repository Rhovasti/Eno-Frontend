#!/usr/bin/env python3
"""
Batch Road Generation Script
Generates roads for all cities in the dataset using the optimized road generation script.
"""

import os
import sys
import json
import time
import logging
from pathlib import Path
import subprocess
import glob

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def find_city_files(input_dir: Path) -> list:
    """Find all building GeoJSON files and extract city names."""
    patterns = [
        "buildings_*.geojson_fixed.geojson_poly.geojson",
        "buildings_*.geojson_poly.geojson",
        "buildings_*.geojson.geojson",
        "buildings_*.geojson"
    ]

    city_files = []
    for pattern in patterns:
        files = glob.glob(str(input_dir / pattern))
        for file_path in files:
            filename = Path(file_path).name
            # Extract city name from filename
            if "_fixed.geojson_poly.geojson" in filename:
                city_name = filename.replace("buildings_", "").replace(".geojson_fixed.geojson_poly.geojson", "")
            elif "_poly.geojson" in filename:
                city_name = filename.replace("buildings_", "").replace(".geojson_poly.geojson", "")
            elif ".geojson.geojson" in filename:
                city_name = filename.replace("buildings_", "").replace(".geojson.geojson", "")
            elif ".geojson" in filename:
                city_name = filename.replace("buildings_", "").replace(".geojson", "")
            else:
                continue

            city_files.append((city_name, file_path))

    # Remove duplicates, preferring the most processed version
    city_dict = {}
    for city_name, file_path in city_files:
        if city_name not in city_dict:
            city_dict[city_name] = file_path
        else:
            # Prefer more processed files
            current = city_dict[city_name]
            if "_fixed.geojson_poly.geojson" in file_path and "_fixed.geojson_poly.geojson" not in current:
                city_dict[city_name] = file_path
            elif "_poly.geojson" in file_path and ".geojson" == current[-8:]:
                city_dict[city_name] = file_path

    return list(city_dict.items())


def get_file_size_category(file_path: str) -> str:
    """Categorize file by number of lines as proxy for building count."""
    try:
        with open(file_path, 'r') as f:
            lines = sum(1 for _ in f)

        if lines < 100:
            return "tiny"
        elif lines < 1000:
            return "small"
        elif lines < 10000:
            return "medium"
        elif lines < 100000:
            return "large"
        else:
            return "huge"
    except Exception:
        return "unknown"


def process_city(city_name: str, script_path: Path, input_dir: Path, output_dir: Path) -> dict:
    """Process a single city and return results."""
    start_time = time.time()

    try:
        # Run the road generation script
        cmd = [
            "python3", str(script_path),
            "--input-dir", str(input_dir),
            "--output-dir", str(output_dir),
            city_name
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

        elapsed_time = time.time() - start_time

        if result.returncode == 0:
            # Parse output for road count
            output_lines = result.stdout.strip().split('\n')
            roads_generated = 0
            for line in output_lines:
                if "Successfully generated" in line and "roads for" in line:
                    try:
                        roads_generated = int(line.split(" ")[2])
                    except (IndexError, ValueError):
                        pass

            return {
                'status': 'success',
                'city': city_name,
                'roads_generated': roads_generated,
                'processing_time': elapsed_time,
                'output': result.stdout
            }
        else:
            return {
                'status': 'error',
                'city': city_name,
                'error': result.stderr,
                'processing_time': elapsed_time
            }

    except subprocess.TimeoutExpired:
        return {
            'status': 'timeout',
            'city': city_name,
            'processing_time': 60.0
        }
    except Exception as e:
        return {
            'status': 'exception',
            'city': city_name,
            'error': str(e),
            'processing_time': time.time() - start_time
        }


def main():
    """Main batch processing function."""
    # Setup paths
    script_dir = Path(__file__).parent
    road_script = script_dir / "generate_local_roads.py"
    input_dir = Path("/root/Eno/qgis/yksittäiset/buildings")
    output_dir = Path("/root/Eno/Eno-Frontend/Mundi/local-data/roads")

    # Find all city files
    city_files = find_city_files(input_dir)
    logger.info(f"Found {len(city_files)} cities to process")

    # Sort by file size for better progress reporting
    city_data = []
    for city_name, file_path in city_files:
        size_category = get_file_size_category(file_path)
        city_data.append((city_name, file_path, size_category))

    # Sort by size category
    size_order = {"tiny": 0, "small": 1, "medium": 2, "large": 3, "huge": 4, "unknown": 5}
    city_data.sort(key=lambda x: size_order.get(x[2], 6))

    # Process cities
    results = []
    total_cities = len(city_data)

    for i, (city_name, file_path, size_category) in enumerate(city_data, 1):
        logger.info(f"Processing city {i}/{total_cities}: {city_name} ({size_category})")

        result = process_city(city_name, road_script, input_dir, output_dir)
        results.append(result)

        # Log result
        if result['status'] == 'success':
            logger.info(f"  ✅ {city_name}: {result['roads_generated']} roads in {result['processing_time']:.2f}s")
        elif result['status'] == 'timeout':
            logger.warning(f"  ⏱️ {city_name}: Timeout after 60s")
        else:
            logger.error(f"  ❌ {city_name}: {result['status']} - {result.get('error', 'Unknown error')}")

    # Generate summary report
    successful = [r for r in results if r['status'] == 'success']
    failed = [r for r in results if r['status'] != 'success']

    total_roads = sum(r['roads_generated'] for r in successful)
    total_time = sum(r['processing_time'] for r in results)
    avg_time = total_time / len(results) if results else 0

    logger.info(f"\n📊 BATCH PROCESSING COMPLETE:")
    logger.info(f"  Cities processed: {total_cities}")
    logger.info(f"  Successful: {len(successful)}")
    logger.info(f"  Failed: {len(failed)}")
    logger.info(f"  Total roads generated: {total_roads}")
    logger.info(f"  Total processing time: {total_time:.2f}s")
    logger.info(f"  Average time per city: {avg_time:.2f}s")

    # Save detailed results
    results_file = output_dir / "batch_processing_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            'summary': {
                'total_cities': total_cities,
                'successful': len(successful),
                'failed': len(failed),
                'total_roads': total_roads,
                'total_time': total_time,
                'average_time': avg_time
            },
            'results': results
        }, f, indent=2)

    logger.info(f"📄 Detailed results saved to: {results_file}")

    # List failed cities for manual inspection
    if failed:
        logger.warning("\n❌ Failed cities:")
        for result in failed:
            logger.warning(f"  {result['city']}: {result['status']}")


if __name__ == '__main__':
    main()