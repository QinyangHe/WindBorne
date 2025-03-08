#!/usr/bin/env python3
"""
Test script to fetch and analyze the raw JSON data from the WindBorne API
for the past 24 hours, including corrupted data.
"""

import json
import httpx
import asyncio
from datetime import datetime
import sys

# Base URL for the WindBorne API
BASE_URL = "https://a.windbornesystems.com/treasure"

async def fetch_raw_data(hour):
    """
    Fetch raw data for a specific hour, returning the status code,
    raw content, and attempt to parse it as JSON
    """
    url = f"{BASE_URL}/{hour:02d}.json"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            status_code = response.status_code
            raw_content = response.text
            
            # Try to parse JSON but don't throw exception if it fails
            parsed_json = None
            json_error = None
            
            try:
                parsed_json = response.json()
            except json.JSONDecodeError as e:
                json_error = str(e)
                
            return {
                "hour": hour,
                "url": url,
                "status_code": status_code,
                "content_length": len(raw_content),
                "raw_content": raw_content,
                "json_parsed": parsed_json is not None,
                "json_error": json_error,
                "parsed_json": parsed_json
            }
    except Exception as e:
        return {
            "hour": hour,
            "url": url,
            "error": str(e)
        }

def analyze_json_content(content):
    """Analyze the structure of JSON content"""
    if not content:
        return "No content"
    
    try:
        if isinstance(content, list):
            return f"List with {len(content)} items. First few items: {content[:3]}"
        elif isinstance(content, dict):
            return f"Dictionary with keys: {list(content.keys())}"
        else:
            return f"Unknown type: {type(content)}"
    except Exception as e:
        return f"Error analyzing: {str(e)}"

def print_detailed_report(result):
    """Print a detailed report of the API result"""
    print(f"\n{'='*80}")
    print(f"HOUR: {result['hour']:02d} ({datetime.now().hour - result['hour']} hours ago)")
    print(f"URL: {result['url']}")
    
    if "error" in result:
        print(f"ERROR: {result['error']}")
        return
    
    print(f"Status: {result['status_code']}")
    print(f"Content Length: {result['content_length']} bytes")
    
    if result['json_parsed']:
        print(f"JSON: Successfully parsed")
        print(f"Structure: {analyze_json_content(result['parsed_json'])}")
    else:
        print(f"JSON: Parse FAILED - {result['json_error']}")
        
        # Try to identify where in the content the error occurs
        if result['json_error'] and 'char' in result['json_error']:
            try:
                char_pos = int(result['json_error'].split('char ')[1].split(')')[0])
                error_context = result['raw_content'][max(0, char_pos-20):min(len(result['raw_content']), char_pos+20)]
                print(f"Error context: ...{error_context}...")
                print(f"Error position: {' ' * (error_context.find(result['raw_content'][char_pos]) + 3)}^")
            except Exception:
                pass
    
    # Print the raw content with line numbers for examination
    print("\nRaw Content:")
    lines = result['raw_content'].split('\n')
    for i, line in enumerate(lines):
        print(f"{i+1:3d}: {line}")
    
    # Try to validate data structure if it looks like coordinates
    if result['json_parsed'] and isinstance(result['parsed_json'], list):
        valid_coords = 0
        invalid_coords = 0
        
        for item in result['parsed_json']:
            if isinstance(item, list) and len(item) == 3:
                try:
                    if all(isinstance(x, (int, float)) for x in item):
                        valid_coords += 1
                    else:
                        invalid_coords += 1
                except:
                    invalid_coords += 1
            else:
                invalid_coords += 1
        
        print(f"\nCoordinate Analysis: {valid_coords} valid, {invalid_coords} invalid")

async def main():
    print(f"Fetching WindBorne balloon data for the past 24 hours at {datetime.now()}")
    print(f"Base URL: {BASE_URL}")
    
    # Fetch all hours
    tasks = [fetch_raw_data(hour) for hour in range(24)]
    results = await asyncio.gather(*tasks)
    
    # Summary
    fetch_success = sum(1 for r in results if "status_code" in r)
    json_success = sum(1 for r in results if "json_parsed" in r and r["json_parsed"])
    
    print(f"\n{'='*80}")
    print(f"SUMMARY: {fetch_success}/24 hours fetched, {json_success}/{fetch_success} valid JSON")
    print(f"{'='*80}")
    
    # Print detailed report for each hour
    for result in results:
        print_detailed_report(result)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(main()) 