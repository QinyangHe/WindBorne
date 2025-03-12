import json
import logging
import math
import os
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Union

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="WindBorne Balloon Tracker")

# Determine static and template directories based on environment
static_dir = os.environ.get("STATIC_DIR", "app/static")
templates_dir = os.environ.get("TEMPLATES_DIR", "app/templates")

# Mount static files
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Set up templates
templates = Jinja2Templates(directory=templates_dir)

# Base URL for the WindBorne API
BASE_URL = "https://a.windbornesystems.com/treasure"


class BalloonData(BaseModel):
    positions: List[List[float]]
    timestamp: str
    corrupted: bool
    error_type: Optional[str] = None
    error_message: Optional[str] = None


def extract_coordinates_from_text(text: str) -> List[List[float]]:
    """
    Extract valid coordinate triplets from text using regex pattern matching.
    This bypasses JSON parsing errors by directly finding patterns that match
    the expected coordinate format.
    
    Args:
        text: The raw text to extract coordinates from
        
    Returns:
        List of valid coordinate triplets [lat, lng, altitude]
    """
    # Pattern to match [float, float, float] coordinate triplets
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
            if -90 <= lat <= 90 and -180 <= lng <= 180 and alt > 0 and math.isfinite(lat) and math.isfinite(lng) and math.isfinite(alt):
                coordinates.append([lat, lng, alt])
        except (ValueError, TypeError):
            # Skip any conversion errors
            pass
    
    return coordinates


async def fetch_balloon_data(hour: int) -> Tuple[Optional[List[List[float]]], bool, Optional[str], Optional[str]]:
    """
    Fetch balloon position data from the WindBorne API
    
    Args:
        hour: Hours ago (0-23)
        
    Returns:
        Tuple of (data, is_corrupted, error_type, error_message)
    """
    url = f"{BASE_URL}/{hour:02d}.json"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            # Get the raw text content
            raw_content = response.text
            
            # First try standard JSON parsing
            try:
                data = response.json()
                
                # Validate data structure
                if not isinstance(data, list):
                    logger.warning(f"Data at {url} is not a list")
                    # Fall back to regex extraction
                    extracted_coords = extract_coordinates_from_text(raw_content)
                    if extracted_coords:
                        logger.info(f"Extracted {len(extracted_coords)} coordinates using regex from {url}")
                        return extracted_coords, False, "json_extracted", f"Extracted {len(extracted_coords)} coordinates from invalid JSON format"
                    else:
                        return None, True, "format_error", "Data is not in the expected list format"
                
                # Check for valid coordinates and filter out invalid ones
                valid_positions = []
                corrupted_count = 0
                
                for item in data:
                    valid_coords = True
                    
                    if not isinstance(item, list) or len(item) != 3:
                        corrupted_count += 1
                        continue
                    
                    # Check that all values are finite numbers
                    for coord in item:
                        if not isinstance(coord, (int, float)) or not math.isfinite(coord):
                            valid_coords = False
                            corrupted_count += 1
                            break
                    
                    if valid_coords and -90 <= item[0] <= 90 and -180 <= item[1] <= 180 and item[2] > 0:
                        valid_positions.append(item)
                    else:
                        corrupted_count += 1
                
                # If we have no valid positions, consider the data corrupted
                if not valid_positions:
                    logger.warning(f"No valid positions found in {url}")
                    return None, True, "all_corrupted", "All coordinates in the data are corrupted"
                
                # If we have some valid and some corrupted, return partial data
                if corrupted_count > 0:
                    logger.info(f"Found {corrupted_count} corrupted coordinates in {url}")
                    return valid_positions, False, "partial_corruption", f"{corrupted_count} coordinates were corrupted and filtered out"
                    
                return valid_positions, False, None, None
                
            except json.JSONDecodeError as e:
                # JSON parsing failed, try regex extraction
                logger.error(f"JSON decode error for {url}: {e}")
                
                # Try to extract coordinates using regex
                extracted_coords = extract_coordinates_from_text(raw_content)
                if extracted_coords:
                    logger.info(f"Extracted {len(extracted_coords)} coordinates using regex from {url}")
                    return extracted_coords, False, "json_extracted", f"Extracted {len(extracted_coords)} coordinates from invalid JSON format"
                else:
                    return None, True, "json_error", f"Invalid JSON format: {str(e)}"
            
    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code
        if status_code == 404:
            logger.error(f"Timestamp not found (404) for {url}: {e}")
            return None, True, "not_found", f"Timestamp {hour} hours ago is not available (404 Not Found)"
        else:
            logger.error(f"HTTP error when fetching {url}: {e}")
            return None, True, "http_error", f"HTTP error {status_code}"
            
    except httpx.RequestError as e:
        logger.error(f"Request error when fetching {url}: {e}")
        return None, True, "request_error", f"Network error when fetching data: {str(e)}"
        
    except Exception as e:
        logger.error(f"Unexpected error when fetching {url}: {e}")
        return None, True, "unknown_error", f"Unexpected error: {str(e)}"


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Render the main page"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/balloons")
async def get_balloon_data():
    """
    Fetch balloon data for the last 24 hours
    """
    results = []
    error_hours = []
    
    for hour in range(24):
        positions, corrupted, error_type, error_message = await fetch_balloon_data(hour)
        
        timestamp = datetime.now() - timedelta(hours=hour)
        timestamp_str = timestamp.strftime("%Y-%m-%d %H:00:00")
        
        if corrupted:
            error_hours.append({
                "hour": hour,
                "type": error_type,
                "message": error_message
            })
            
            results.append({
                "positions": [],
                "timestamp": timestamp_str,
                "corrupted": True,
                "error_type": error_type,
                "error_message": error_message
            })
        else:
            error_info = None
            if error_type:
                error_info = {
                    "hour": hour,
                    "type": error_type,
                    "message": error_message
                }
                error_hours.append(error_info)
            
            results.append({
                "positions": positions,
                "timestamp": timestamp_str,
                "corrupted": False,
                "error_type": error_type,
                "error_message": error_message
            })
    
    return {
        "data": results,
        "error_hours": error_hours
    }


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 