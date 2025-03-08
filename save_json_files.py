#!/usr/bin/env python3
"""
Simple script to fetch and save raw JSON data from the WindBorne API for the past 24 hours.
This script saves each response to a separate file for easier examination.
"""

import os
import httpx
import asyncio
import sys
from datetime import datetime

# Base URL for the WindBorne API
BASE_URL = "https://a.windbornesystems.com/treasure"
OUTPUT_DIR = "raw_json_files"

async def fetch_and_save(hour):
    """Fetch data for a specific hour and save raw content to a file"""
    url = f"{BASE_URL}/{hour:02d}.json"
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{OUTPUT_DIR}/{timestamp}_{hour:02d}.json"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            print(f"Fetching {url}...")
            response = await client.get(url)
            
            # Save the raw content
            with open(filename, 'w') as f:
                f.write(response.text)
            
            print(f"✅ Hour {hour:02d}: Status {response.status_code}, saved to {filename}")
            return True
    except Exception as e:
        print(f"❌ Hour {hour:02d}: Error - {str(e)}")
        return False

async def main():
    print(f"Fetching WindBorne balloon data for the past 24 hours at {datetime.now()}")
    print(f"Base URL: {BASE_URL}")
    
    # Create output directory if it doesn't exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Raw JSON files will be saved to: {os.path.abspath(OUTPUT_DIR)}")
    
    # Fetch all hours
    tasks = [fetch_and_save(hour) for hour in range(24)]
    results = await asyncio.gather(*tasks)
    
    # Summary
    success_count = sum(1 for r in results if r)
    print(f"\nSUMMARY: Successfully saved {success_count}/24 JSON files")
    print(f"Check the {OUTPUT_DIR} directory to examine the raw data")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(main()) 