#!/usr/bin/env python3
"""
Script to fetch and fix the WindBorne API data with multiple format issues:
1. Extra newline at the beginning of some files
2. Trailing '%' character at the end
"""

import json
import httpx
import asyncio
import sys
from datetime import datetime
import re

# Base URL for the WindBorne API
BASE_URL = "https://a.windbornesystems.com/treasure"

async def fetch_and_fix_json(hour):
    """
    Fetch data for a specific hour and fix the JSON format issues
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
            
            # Fix 1: Remove leading/trailing whitespace
            content = raw_content.strip()
            
            # Fix 2: If content doesn't start with '[', add it
            if not content.startswith('['):
                content = '[' + content
                print(f"  • Added missing opening bracket")
            
            # Fix 3: If content doesn't end with ']', add it
            if not content.endswith(']'):
                # Find the last closing bracket
                match = re.search(r']([^]]*?)$', content)
                if match:
                    content = content[:match.start() + 1]
                    print(f"  • Removed {len(match.group(1))} trailing characters after JSON")
                else:
                    content = content + ']'
                    print(f"  • Added missing closing bracket")
            
            # Fix 4: Remove any trailing '%' characters
            if '%' in content:
                content = content.replace('%', '')
                print(f"  • Removed '%' character(s)")
            
            # Try to parse the fixed content
            try:
                data = json.loads(content)
                print(f"✅ Hour {hour:02d}: Successfully parsed {len(data)} coordinates")
                return data
            except json.JSONDecodeError as e:
                print(f"❌ Hour {hour:02d}: JSON parsing failed: {e}")
                
                # Additional debugging for failed parsing
                print(f"  • First 50 chars: {content[:50]}...")
                print(f"  • Last 50 chars: ...{content[-50:]}")
                
                # Try aggressive repair by extracting what looks like valid JSON
                # This looks for a pattern of arrays inside arrays
                matches = re.findall(r'\[\s*\[\s*[-0-9.]+\s*,\s*[-0-9.]+\s*,\s*[-0-9.]+\s*\]\s*\]', content)
                if matches:
                    print(f"  • Found {len(matches)} potential coordinate arrays")
                    for match in matches[:2]:  # Show just the first 2
                        print(f"  • Example: {match[:30]}...")
                
                return None
                
    except Exception as e:
        print(f"❌ Hour {hour:02d}: Error - {str(e)}")
        return None

async def main():
    print(f"Fetching and fixing WindBorne balloon data at {datetime.now()}")
    print(f"Base URL: {BASE_URL}")
    
    # Fetch and fix data for all hours
    all_data = {}
    for hour in range(24):
        data = await fetch_and_fix_json(hour)
        if data:
            all_data[hour] = data
    
    # Summary
    print(f"\nSUMMARY: Successfully processed {len(all_data)}/24 hours")
    print(f"Total coordinate sets available: {sum(len(coords) for coords in all_data.values() if coords)}")
    
    # Save the fixed data to a single file
    fixed_file = "fixed_balloon_data.json"
    with open(fixed_file, 'w') as f:
        json.dump(all_data, f)
    print(f"Fixed data saved to {fixed_file}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(main()) 