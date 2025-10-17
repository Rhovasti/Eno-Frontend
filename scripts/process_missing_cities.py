#!/usr/bin/env python3
"""
Process the 14 cities that were missed in the initial batch run
"""

import os
import sys
import time
import logging
from pathlib import Path
import subprocess

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def process_missing_cities():
    """Process the 14 cities that were missed in the initial batch run."""

    # The 14 cities that failed in the original batch
    missing_cities = [
        'citadel_of_utaia', 'tsin', 'uiaria', 'tlida', 'tetonykut', 'tisvarmend',
        'uyaria', 'urir', 'szargony', 'tsanghom', 'teveh', 'ubahmia',
        'tonkhanhad', 'tasa'
    ]

    # Setup paths
    script_dir = Path(__file__).parent
    road_script = script_dir / "generate_local_roads.py"
    input_dir = Path("/root/Eno/qgis/yksittäiset/buildings")
    output_dir = Path("/root/Eno/Eno-Frontend/Mundi/local-data/roads")

    logger.info(f"Processing {len(missing_cities)} previously failed cities")

    results = []
    successful = 0

    for i, city_name in enumerate(missing_cities, 1):
        logger.info(f"Processing city {i}/{len(missing_cities)}: {city_name}")

        start_time = time.time()

        try:
            # Run the road generation script
            cmd = [
                "python3", str(road_script),
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

                results.append({
                    'city': city_name,
                    'status': 'success',
                    'roads_generated': roads_generated,
                    'processing_time': elapsed_time
                })
                successful += 1
                logger.info(f"  ✅ {city_name}: {roads_generated} roads in {elapsed_time:.2f}s")
            else:
                results.append({
                    'city': city_name,
                    'status': 'error',
                    'error': result.stderr,
                    'processing_time': elapsed_time
                })
                logger.error(f"  ❌ {city_name}: {result.stderr}")

        except subprocess.TimeoutExpired:
            results.append({
                'city': city_name,
                'status': 'timeout',
                'processing_time': 60.0
            })
            logger.warning(f"  ⏱️ {city_name}: Timeout after 60s")
        except Exception as e:
            results.append({
                'city': city_name,
                'status': 'exception',
                'error': str(e),
                'processing_time': time.time() - start_time
            })
            logger.error(f"  💥 {city_name}: {str(e)}")

    # Summary
    total_roads = sum(r.get('roads_generated', 0) for r in results)
    total_time = sum(r['processing_time'] for r in results)

    logger.info(f"\n📊 MISSING CITIES PROCESSING COMPLETE:")
    logger.info(f"  Cities processed: {len(missing_cities)}")
    logger.info(f"  Successful: {successful}")
    logger.info(f"  Failed: {len(missing_cities) - successful}")
    logger.info(f"  Total roads generated: {total_roads}")
    logger.info(f"  Total processing time: {total_time:.2f}s")
    logger.info(f"  Average time per city: {total_time/len(missing_cities):.2f}s")

    if successful == len(missing_cities):
        logger.info("🎉 ALL MISSING CITIES SUCCESSFULLY PROCESSED!")
    else:
        failed = [r for r in results if r['status'] != 'success']
        logger.warning(f"\n❌ {len(failed)} cities still failed:")
        for result in failed:
            logger.warning(f"  {result['city']}: {result['status']}")

if __name__ == '__main__':
    process_missing_cities()