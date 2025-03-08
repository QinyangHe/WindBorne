// Initialize global variables
let map;
let balloonData = [];
let markers = [];
let pathLines = [];
let animationInterval = null;
let currentTimeIndex = 0;

// Initialize the map when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    fetchBalloonData();
    setupEventListeners();
});

// Initialize Leaflet map
function initializeMap() {
    // Create map centered on the equator
    map = L.map('map', {
        center: [0, 0],
        zoom: 2,
        minZoom: 2,
        maxBounds: [[-90, -180], [90, 180]],
        maxBoundsViscosity: 1.0 // Prevents dragging outside bounds
    });
    
    // Add the base map layer (OpenStreetMap) with noWrap option
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        noWrap: true, // Prevents the map from repeating horizontally
        bounds: [[-90, -180], [90, 180]]
    }).addTo(map);
}

// Fetch balloon data from the API
async function fetchBalloonData() {
    try {
        const response = await fetch('/api/balloons');
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        const data = await response.json();
        balloonData = data.data;
        
        // Update UI with balloon count
        updateBalloonCount(balloonData[0]);
        
        // Display balloons for the current time (most recent)
        displayBalloonsAtTime(0);
        
        // Log corrupted hours
        if (data.corrupted_hours.length > 0) {
            console.warn('Corrupted data at hours:', data.corrupted_hours);
        }
    } catch (error) {
        console.error('Error fetching balloon data:', error);
        document.getElementById('balloonCount').innerText = 'Error loading data. Please try again later.';
    }
}

// Display balloons for a specific time index
function displayBalloonsAtTime(timeIndex) {
    // Clear existing markers and paths
    clearMapMarkers();
    
    const timeData = balloonData[timeIndex];
    
    // Update time display
    document.getElementById('timeSlider').value = timeIndex;
    document.getElementById('timeDisplay').innerText = timeIndex === 0 ? 
        'Current' : `${timeIndex} hours ago (${timeData.timestamp})`;
    
    // Check if data is corrupted
    const corruptedNotice = document.getElementById('corruptedNotice');
    if (timeData.corrupted) {
        corruptedNotice.style.display = 'block';
        return;
    } else {
        corruptedNotice.style.display = 'none';
    }
    
    // Add markers for each balloon
    timeData.positions.forEach((position, index) => {
        const [lat, lng, altitude] = position;
        
        // Create a marker for the balloon
        const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: timeIndex === 0 ? '#4285F4' : '#EA4335',
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        // Add popup with balloon info
        marker.bindPopup(`
            <strong>Balloon ${index + 1}</strong><br>
            Latitude: ${lat.toFixed(5)}<br>
            Longitude: ${lng.toFixed(5)}<br>
            Altitude: ${altitude.toFixed(2)} km
        `);
        
        // Add to markers array
        markers.push(marker);
        
        // Add click event to marker
        marker.on('click', () => {
            displayBalloonDetails(index, position, timeData.timestamp);
            drawBalloonPath(index);
        });
    });
    
    // Update balloon count
    updateBalloonCount(timeData);
    
    // Store current time index
    currentTimeIndex = timeIndex;
}

// Draw the path of a balloon across all available timestamps
function drawBalloonPath(balloonIndex) {
    // Clear existing path lines
    clearPathLines();
    
    // Collect all positions for this balloon across time
    const positions = [];
    
    for (let i = 0; i < balloonData.length; i++) {
        const timeData = balloonData[i];
        if (!timeData.corrupted && 
            timeData.positions.length > balloonIndex && 
            timeData.positions[balloonIndex]) {
            
            const [lat, lng] = timeData.positions[balloonIndex];
            positions.push([lat, lng]);
        }
    }
    
    // Create a polyline for the path
    if (positions.length > 1) {
        const pathLine = L.polyline(positions, {
            color: '#FBBC05',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 5'
        }).addTo(map);
        
        pathLines.push(pathLine);
    }
}

// Display balloon details in the sidebar
function displayBalloonDetails(index, position, timestamp) {
    const [lat, lng, altitude] = position;
    document.getElementById('selectedBalloon').innerHTML = `
        <h4>Selected Balloon #${index + 1}</h4>
        <p>
            Latitude: ${lat.toFixed(5)}<br>
            Longitude: ${lng.toFixed(5)}<br>
            Altitude: ${altitude.toFixed(2)} km<br>
            Time: ${timestamp}
        </p>
    `;
}

// Update the balloon count display
function updateBalloonCount(timeData) {
    const balloonCountElement = document.getElementById('balloonCount');
    
    if (timeData.corrupted) {
        balloonCountElement.innerText = 'Data corrupted for this timestamp';
    } else {
        balloonCountElement.innerText = `Showing ${timeData.positions.length} balloons`;
    }
}

// Clear all markers from the map
function clearMapMarkers() {
    markers.forEach(marker => {
        map.removeLayer(marker);
    });
    markers = [];
}

// Clear all path lines from the map
function clearPathLines() {
    pathLines.forEach(line => {
        map.removeLayer(line);
    });
    pathLines = [];
}

// Set up event listeners for UI controls
function setupEventListeners() {
    // Time slider events
    const timeSlider = document.getElementById('timeSlider');
    timeSlider.addEventListener('input', (event) => {
        const timeIndex = parseInt(event.target.value);
        displayBalloonsAtTime(timeIndex);
    });
    
    // Play animation button
    const playButton = document.getElementById('playButton');
    playButton.addEventListener('click', startAnimation);
    
    // Stop animation button
    const stopButton = document.getElementById('stopButton');
    stopButton.addEventListener('click', stopAnimation);
}

// Start the animation of balloon positions over time
function startAnimation() {
    // Stop any existing animation
    stopAnimation();
    
    // Enable stop button, disable play button
    document.getElementById('playButton').disabled = true;
    document.getElementById('stopButton').disabled = false;
    
    // Start from current time index
    let timeIndex = currentTimeIndex;
    
    // Update every 1 second
    animationInterval = setInterval(() => {
        // Increment time index (loop back to 0 if we reach the end)
        timeIndex = (timeIndex + 1) % 24;
        
        // Display balloons for this time
        displayBalloonsAtTime(timeIndex);
        
        // Update slider position
        document.getElementById('timeSlider').value = timeIndex;
    }, 1000);
}

// Stop the animation
function stopAnimation() {
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
        
        // Enable play button, disable stop button
        document.getElementById('playButton').disabled = false;
        document.getElementById('stopButton').disabled = true;
    }
}

// Refresh data periodically (every 5 minutes)
setInterval(fetchBalloonData, 5 * 60 * 1000); 