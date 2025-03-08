#!/usr/bin/env python3
"""
Ultimate script to fix all JSON issues in the WindBorne API data.
This script uses a robust approach that directly extracts the coordinate arrays
regardless of the overall formatting problems.
"""

import json
import httpx
import asyncio
import sys
import re
from datetime import datetime

# Base URL for the WindBorne API
BASE_URL = "https://a.windbornesystems.com/treasure"

def extract_coordinates_from_text(text):
    """
    Extract all valid coordinates from text using regex pattern matching.
    This bypasses JSON parsing errors by directly finding patterns that match
    the expected coordinate format.
    """
    # Pattern to match [float, float, float] coordinate triplets
    # This handles numbers with/without decimal places and negative numbers
    pattern = r'\[\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\]'
    
    matches = re.findall(pattern, text)
    coordinates = []
    
    for match in matches:
        try:
            # Convert string matches to floats
            lat = float(match[0])
            lng = float(match[1])
            alt = float(match[2])
            
            # Validate coordinates
            if -90 <= lat <= 90 and -180 <= lng <= 180 and alt > 0:
                coordinates.append([lat, lng, alt])
        except ValueError:
            # Skip any conversion errors
            pass
    
    return coordinates

async def fetch_and_extract_coordinates(hour):
    """
    Fetch data for a specific hour and extract valid coordinates,
    even if the JSON is malformed
    """
    url = f"{BASE_URL}/{hour:02d}.json"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            print(f"Fetching {url}...")
            response = await client.get(url)
            
            if response.status_code != 200:
                print(f"❌ Hour {hour:02d}: HTTP error {response.status_code}")
                return None
            
            # Get the raw text content
            raw_content = response.text
            
            # First try to parse as normal JSON
            try:
                data = json.loads(raw_content)
                if isinstance(data, list) and all(isinstance(item, list) and len(item) == 3 for item in data):
                    print(f"✅ Hour {hour:02d}: Successfully parsed as valid JSON: {len(data)} coordinates")
                    return data
            except json.JSONDecodeError:
                # JSON parsing failed, fall back to regex extraction
                pass
            
            # Extract coordinates using regex
            coordinates = extract_coordinates_from_text(raw_content)
            
            if coordinates:
                print(f"✅ Hour {hour:02d}: Extracted {len(coordinates)} coordinates using regex")
                return coordinates
            else:
                print(f"❌ Hour {hour:02d}: Failed to extract any valid coordinates")
                return None
                
    except Exception as e:
        print(f"❌ Hour {hour:02d}: Error - {str(e)}")
        return None

async def main():
    print(f"Fetching and fixing WindBorne balloon data at {datetime.now()}")
    print(f"Base URL: {BASE_URL}")
    
    # Fetch and extract coordinates for all hours
    all_data = {}
    for hour in range(24):
        data = await fetch_and_extract_coordinates(hour)
        if data:
            all_data[str(hour).zfill(2)] = data
    
    # Summary
    print(f"\nSUMMARY: Successfully processed {len(all_data)}/24 hours")
    print(f"Total coordinate sets available: {sum(len(coords) for coords in all_data.values())}")
    
    # Save the fixed data to a single file
    fixed_file = "fixed_balloon_data.json"
    with open(fixed_file, 'w') as f:
        json.dump(all_data, f)
    print(f"Fixed data saved to {fixed_file}")
    
    # Create a simpler summary file that can be easily loaded
    summary_file = "balloon_summary.json"
    summary = {
        "total_hours": len(all_data),
        "total_coordinates": sum(len(coords) for coords in all_data.values()),
        "coordinates_per_hour": {hour: len(coords) for hour, coords in all_data.items()},
        "last_updated": datetime.now().isoformat()
    }
    with open(summary_file, 'w') as f:
        json.dump(summary, f)
    print(f"Summary data saved to {summary_file}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(main()) 