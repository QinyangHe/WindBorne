// Initialize global variables
let map;
let balloonData = [];
let markers = [];
let currentTimeIndex = 0;
let currentMarkerSize = 3; // Default marker size
let statsOverlays = []; // For storing statistical visualization layers
let statsChart = null; // For storing Chart.js instance
let altitudeLegend = null; // Track the altitude legend separately
let densityLegend = null; // Track the density legend separately
let clusterLegend = null; // Track the cluster legend separately
let coverageLegend = null; // Track the coverage legend separately

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

// Update all marker sizes based on the current marker size setting
function updateMarkerSizes() {
    markers.forEach(marker => {
        marker.setRadius(currentMarkerSize);
    });
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
        
        // Log error hours
        if (data.error_hours && data.error_hours.length > 0) {
            console.warn('Data issues detected:', data.error_hours);
        }
    } catch (error) {
        console.error('Error fetching balloon data:', error);
        document.getElementById('balloonCount').innerText = 'Error loading data. Please try again later.';
    }
}

// Display balloons for a specific time index
function displayBalloonsAtTime(timeIndex) {
    // Clear existing markers
    clearMapMarkers();
    
    // Clear any stats visualizations
    clearStatsVisualizations();
    
    const timeData = balloonData[timeIndex];
    
    // Update time display
    document.getElementById('timeSlider').value = timeIndex;
    document.getElementById('timeDisplay').innerText = timeIndex === 0 ? 
        'Current' : `${timeIndex} hours ago (${timeData.timestamp})`;
    
    // Handle error display
    const corruptedNotice = document.getElementById('corruptedNotice');
    
    if (timeData.corrupted) {
        // Different messages based on error type
        if (timeData.error_type === "not_found") {
            corruptedNotice.innerHTML = `<strong>Notice:</strong> ${timeData.error_message}`;
            corruptedNotice.style.display = 'block';
        } else {
            corruptedNotice.innerHTML = `<strong>Data Issue:</strong> ${timeData.error_message}`;
            corruptedNotice.style.display = 'block';
        }
        
        // Early return for completely corrupted data
        if (!timeData.positions || timeData.positions.length === 0) {
            return;
        }
    } else if (timeData.error_type === "partial_corruption") {
        // Show warning for partial corruption but still display valid data
        corruptedNotice.innerHTML = `<strong>Partial Data:</strong> ${timeData.error_message}`;
        corruptedNotice.style.display = 'block';
    } else {
        corruptedNotice.style.display = 'none';
    }
    
    // Add markers for each balloon (if we have valid positions)
    if (timeData.positions && timeData.positions.length > 0) {
        timeData.positions.forEach((position, index) => {
            const [lat, lng, altitude] = position;
            
            // Create a marker for the balloon with the current marker size
            const marker = L.circleMarker([lat, lng], {
                radius: currentMarkerSize, // Use the user-selected size
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
            
            // Add click event to marker to show details
            marker.on('click', () => {
                displayBalloonDetails(index, position, timeData.timestamp);
            });
        });
    }
    
    // Update balloon count
    updateBalloonCount(timeData);
    
    // Store current time index
    currentTimeIndex = timeIndex;
    
    // Update statistics display if a type is selected
    updateStatistics();
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
    
    if (timeData.corrupted && (!timeData.positions || timeData.positions.length === 0)) {
        balloonCountElement.innerText = 'No valid data available for this timestamp';
    } else if (timeData.error_type === "partial_corruption") {
        balloonCountElement.innerText = `Showing ${timeData.positions.length} balloons (some data was filtered)`;
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

// Set up event listeners for UI controls
function setupEventListeners() {
    // Time slider events
    const timeSlider = document.getElementById('timeSlider');
    timeSlider.addEventListener('input', (event) => {
        const timeIndex = parseInt(event.target.value);
        displayBalloonsAtTime(timeIndex);
    });
    
    // Marker size slider events
    const markerSizeSlider = document.getElementById('markerSizeSlider');
    const markerSizeDisplay = document.getElementById('markerSizeDisplay');
    
    markerSizeSlider.addEventListener('input', (event) => {
        // Update the current marker size
        currentMarkerSize = parseInt(event.target.value);
        
        // Update the display
        markerSizeDisplay.innerText = currentMarkerSize;
        
        // Update all existing markers
        updateMarkerSizes();
    });
    
    // Statistics selector events
    const statsSelector = document.getElementById('statisticsSelector');
    statsSelector.addEventListener('change', () => {
        updateStatistics();
    });
    
    // Visualize checkbox events
    const visualizeCheckbox = document.getElementById('visualizeStats');
    visualizeCheckbox.addEventListener('change', () => {
        updateStatistics();
    });
    
    // Tab switching events
    const tabs = document.querySelectorAll('.stats-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Hide all tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show corresponding tab content
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(`${tabId}Tab`).classList.add('active');
            
            // If chart tab is activated, make sure chart is properly sized
            if (tabId === 'chart' && statsChart) {
                statsChart.resize();
            }
        });
    });
}

// Clear any stats visualization overlays from the map
function clearStatsVisualizations() {
    // Remove all stat overlays from map
    statsOverlays.forEach(overlay => {
        if (overlay) {
            if (overlay instanceof L.Layer) {
                overlay.remove();
            }
        }
    });
    
    // Clear the overlays array
    statsOverlays = [];
    
    // Remove legends if they exist
    if (altitudeLegend) {
        map.removeControl(altitudeLegend);
        altitudeLegend = null;
    }
    
    if (densityLegend) {
        map.removeControl(densityLegend);
        densityLegend = null;
    }
    
    if (clusterLegend) {
        map.removeControl(clusterLegend);
        clusterLegend = null;
    }
    
    if (coverageLegend) {
        map.removeControl(coverageLegend);
        coverageLegend = null;
    }
    
    // Clear existing chart
    if (statsChart) {
        statsChart.destroy();
        statsChart = null;
    }
}

// Update statistics based on selected type
function updateStatistics() {
    const statsType = document.getElementById('statisticsSelector').value;
    const shouldVisualize = document.getElementById('visualizeStats').checked;
    
    // Clear any existing visualizations
    clearStatsVisualizations();
    
    // Get current timestamp data
    const timeData = balloonData[currentTimeIndex];
    if (!timeData || !timeData.positions || timeData.positions.length === 0) {
        document.getElementById('statsContent').innerHTML = '<div class="stat-row"><span class="stat-label">No data available for statistics</span></div>';
        return;
    }
    
    switch (statsType) {
        case 'altitude':
            displayAltitudeStatistics(timeData, shouldVisualize);
            break;
        case 'basic':
            displayBasicStatistics(timeData, shouldVisualize);
            break;
        case 'coverage':
            displayCoverageStatistics(timeData, shouldVisualize);
            break;
        case 'density':
            displayDensityStatistics(timeData, shouldVisualize);
            break;
        case 'clusters':
            displayClusterStatistics(timeData, shouldVisualize);
            break;
    }
}

// Display altitude statistics
function displayAltitudeStatistics(timeData, visualize) {
    // Extract altitude data
    const altitudes = timeData.positions.map(pos => pos[2]);
    
    // Basic altitude stats
    const min = Math.min(...altitudes);
    const max = Math.max(...altitudes);
    const mean = altitudes.reduce((sum, alt) => sum + alt, 0) / altitudes.length;
    const median = calculateMedian(altitudes);
    
    // Generate altitude distribution (histogram)
    const binSize = 2; // 2 km bins
    const bins = createHistogramBins(altitudes, binSize, min, max);
    
    // Regional altitude analysis
    const regionData = calculateRegionalAltitudes(timeData.positions);
    
    // Temporal trend for altitude
    const altitudeOverTime = calculateAltitudeTrend();
    
    // Display stats in the numbers tab
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = `
        <h4>Altitude Statistics</h4>
        <div class="stat-row">
            <span class="stat-label">Minimum Altitude:</span>
            <span class="stat-value">${min.toFixed(2)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Maximum Altitude:</span>
            <span class="stat-value">${max.toFixed(2)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Mean Altitude:</span>
            <span class="stat-value">${mean.toFixed(2)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Median Altitude:</span>
            <span class="stat-value">${median.toFixed(2)} km</span>
        </div>
        
        <h4>Regional Altitude Analysis</h4>
        <div class="stat-row">
            <span class="stat-label">Northern Hemisphere:</span>
            <span class="stat-value">${regionData.northernAvg.toFixed(2)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Southern Hemisphere:</span>
            <span class="stat-value">${regionData.southernAvg.toFixed(2)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Eastern Hemisphere:</span>
            <span class="stat-value">${regionData.easternAvg.toFixed(2)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Western Hemisphere:</span>
            <span class="stat-value">${regionData.westernAvg.toFixed(2)} km</span>
        </div>
    `;
    
    // Create chart for altitude distribution
    createAltitudeChart(bins, altitudeOverTime);
    
    // Visualize on the map if requested
    if (visualize) {
        visualizeAltitudes(timeData.positions);
    }
}

// Calculate the median of an array of numbers
function calculateMedian(values) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
        return sorted[middle];
    }
}

// Create histogram bins for a set of values
function createHistogramBins(values, binSize, min, max) {
    // Calculate number of bins
    const numBins = Math.ceil((max - min) / binSize);
    
    // Initialize bins
    const bins = Array(numBins).fill(0);
    
    // Count values in each bin
    values.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binSize), numBins - 1);
        bins[binIndex]++;
    });
    
    // Create bin objects with labels
    const binObjects = bins.map((count, i) => {
        const lowerBound = min + (i * binSize);
        const upperBound = min + ((i + 1) * binSize);
        return {
            label: `${lowerBound.toFixed(0)}-${upperBound.toFixed(0)} km`,
            count,
            lowerBound,
            upperBound
        };
    });
    
    return binObjects;
}

// Calculate regional altitude statistics
function calculateRegionalAltitudes(positions) {
    // Filter positions into hemispheres
    const northernPos = positions.filter(pos => pos[0] > 0);
    const southernPos = positions.filter(pos => pos[0] <= 0);
    const easternPos = positions.filter(pos => pos[1] > 0);
    const westernPos = positions.filter(pos => pos[1] <= 0);
    
    // Calculate average altitudes for each region
    const northernAvg = northernPos.length > 0 ? 
        northernPos.reduce((sum, pos) => sum + pos[2], 0) / northernPos.length : 0;
        
    const southernAvg = southernPos.length > 0 ? 
        southernPos.reduce((sum, pos) => sum + pos[2], 0) / southernPos.length : 0;
        
    const easternAvg = easternPos.length > 0 ? 
        easternPos.reduce((sum, pos) => sum + pos[2], 0) / easternPos.length : 0;
        
    const westernAvg = westernPos.length > 0 ? 
        westernPos.reduce((sum, pos) => sum + pos[2], 0) / westernPos.length : 0;
    
    return {
        northernAvg,
        southernAvg,
        easternAvg,
        westernAvg
    };
}

// Calculate altitude trends over time
function calculateAltitudeTrend() {
    const trendData = [];
    
    // Loop through available hours
    for (let i = 0; i < balloonData.length; i++) {
        const timeData = balloonData[i];
        
        if (timeData && !timeData.corrupted && timeData.positions && timeData.positions.length > 0) {
            // Calculate mean altitude
            const altitudes = timeData.positions.map(pos => pos[2]);
            const mean = altitudes.reduce((sum, alt) => sum + alt, 0) / altitudes.length;
            const median = calculateMedian(altitudes);
            
            trendData.push({
                hour: i,
                timestamp: timeData.timestamp,
                mean: mean,
                median: median,
                count: altitudes.length
            });
        }
    }
    
    return trendData;
}

// Create a chart for altitude distribution
function createAltitudeChart(bins, trendData) {
    // Get the canvas element
    const ctx = document.getElementById('statsChart');
    
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create tabs for different charts
    const chartOptions = `
        <div style="margin-bottom: 10px;">
            <label>
                <input type="radio" name="chartType" value="histogram" checked> Altitude Distribution
            </label>
            <label style="margin-left: 10px;">
                <input type="radio" name="chartType" value="trend"> Altitude Trend
            </label>
        </div>
    `;
    
    // Add options before chart
    const chartContainer = document.querySelector('.chart-container');
    const existingOptions = chartContainer.querySelector('.chart-options');
    
    if (existingOptions) {
        existingOptions.innerHTML = chartOptions;
    } else {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'chart-options';
        optionsDiv.innerHTML = chartOptions;
        chartContainer.insertBefore(optionsDiv, ctx);
    }
    
    // Create histogram chart by default
    createHistogramChart(ctx, bins);
    
    // Add event listeners for chart type radio buttons
    document.querySelectorAll('input[name="chartType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'histogram') {
                createHistogramChart(ctx, bins);
            } else {
                createTrendChart(ctx, trendData);
            }
        });
    });
}

// Create histogram chart
function createHistogramChart(ctx, bins) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: bins.map(bin => bin.label),
            datasets: [{
                label: 'Balloon Count',
                data: bins.map(bin => bin.count),
                backgroundColor: 'rgba(66, 133, 244, 0.6)',
                borderColor: 'rgba(66, 133, 244, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Balloons'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Altitude Range (km)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Altitude Distribution'
                }
            }
        }
    });
}

// Create trend chart
function createTrendChart(ctx, trendData) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Sort data by hour
    const sortedData = [...trendData].sort((a, b) => a.hour - b.hour);
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedData.map(data => `${data.hour}h ago`),
            datasets: [
                {
                    label: 'Mean Altitude (km)',
                    data: sortedData.map(data => data.mean),
                    borderColor: 'rgba(66, 133, 244, 1)',
                    backgroundColor: 'rgba(66, 133, 244, 0.1)',
                    tension: 0.1,
                    fill: false
                },
                {
                    label: 'Median Altitude (km)',
                    data: sortedData.map(data => data.median),
                    borderColor: 'rgba(234, 67, 53, 1)',
                    backgroundColor: 'rgba(234, 67, 53, 0.1)',
                    tension: 0.1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Altitude (km)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Altitude Trend Over Time'
                }
            }
        }
    });
}

// Visualize altitudes on the map using colors
function visualizeAltitudes(positions) {
    if (!positions || positions.length === 0) return;
    
    // Find min and max altitudes for color scaling
    const altitudes = positions.map(pos => pos[2]);
    const minAlt = Math.min(...altitudes);
    const maxAlt = Math.max(...altitudes);
    const range = maxAlt - minAlt;
    
    // Create a color scale for altitudes
    function getAltitudeColor(altitude) {
        // Normalize altitude to 0-1 range
        const normalized = Math.min(1, Math.max(0, (altitude - minAlt) / range));
        
        // Color scale from blue (low) to red (high)
        const r = Math.floor(normalized * 255);
        const g = Math.floor(Math.max(0, 150 - Math.abs(normalized - 0.5) * 300));
        const b = Math.floor(255 - normalized * 255);
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Add balloons colored by altitude
    positions.forEach((pos, index) => {
        const [lat, lng, altitude] = pos;
        const color = getAltitudeColor(altitude);
        
        const marker = L.circleMarker([lat, lng], {
            radius: currentMarkerSize,
            fillColor: color,
            color: 'white',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.7
        }).addTo(map);
        
        marker.bindPopup(`
            <strong>Balloon at ${lat.toFixed(3)}, ${lng.toFixed(3)}</strong><br>
            Altitude: ${altitude.toFixed(2)} km
        `);
        
        statsOverlays.push(marker);
    });
    
    // Add a legend for altitude colors
    // Remove previous legend if it exists
    if (altitudeLegend) {
        map.removeControl(altitudeLegend);
    }
    
    altitudeLegend = L.control({ position: 'bottomright' });
    
    altitudeLegend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';
        
        div.innerHTML = '<h4 style="margin:0 0 5px 0">Altitude (km)</h4>';
        
        // Add color gradient
        const steps = 5;
        const stepSize = range / steps;
        
        div.innerHTML += `<div style="height:150px;width:20px;margin-right:10px;float:left;background:linear-gradient(to top, rgb(0,0,255), rgb(0,150,0), rgb(255,0,0));"></div>`;
        
        div.innerHTML += `<div style="float:left">`;
        for (let i = 0; i <= steps; i++) {
            const alt = maxAlt - i * stepSize;
            div.innerHTML += `<div style="height:30px;line-height:30px;">${alt.toFixed(1)}</div>`;
        }
        div.innerHTML += `</div>`;
        
        div.innerHTML += `<div style="clear:both;"></div>`;
        
        return div;
    };
    
    altitudeLegend.addTo(map);
    statsOverlays.push(altitudeLegend);
}

// Display basic statistics (placeholder for now)
function displayBasicStatistics(timeData, visualize) {
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = `
        <h4>Basic Statistics</h4>
        <div class="stat-row">
            <span class="stat-label">Number of Balloons:</span>
            <span class="stat-value">${timeData.positions.length}</span>
        </div>
    `;
}

// Display coverage statistics
function displayCoverageStatistics(timeData, visualize) {
    const positions = timeData.positions;
    
    // Calculate coverage metrics
    const coverageMetrics = calculateCoverageMetrics(positions);
    
    // Calculate regional distribution
    const regionDistribution = calculateRegionalDistribution(positions);
    
    // Calculate coverage gaps
    const coverageGaps = identifyCoverageGaps(positions);
    
    // Display stats in the numbers tab
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = `
        <h4>Global Coverage Metrics</h4>
        <div class="stat-row">
            <span class="stat-label">Coverage Density:</span>
            <span class="stat-value">${coverageMetrics.density.toFixed(4)} balloons per million km²</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Maximum Gap Distance:</span>
            <span class="stat-value">${coverageMetrics.maxGapDistance.toFixed(0)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Covered Area (est.):</span>
            <span class="stat-value">${coverageMetrics.coveredPercentage.toFixed(1)}% of Earth's surface</span>
        </div>
        
        <h4>Regional Distribution</h4>
        <div class="stat-row">
            <span class="stat-label">Northern Hemisphere:</span>
            <span class="stat-value">${regionDistribution.northernPercent.toFixed(1)}% (${regionDistribution.northern} balloons)</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Southern Hemisphere:</span>
            <span class="stat-value">${regionDistribution.southernPercent.toFixed(1)}% (${regionDistribution.southern} balloons)</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Equatorial Region (±23.5°):</span>
            <span class="stat-value">${regionDistribution.equatorialPercent.toFixed(1)}% (${regionDistribution.equatorial} balloons)</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Polar Regions (>66.5°):</span>
            <span class="stat-value">${regionDistribution.polarPercent.toFixed(1)}% (${regionDistribution.polar} balloons)</span>
        </div>
        
        <h4>Coverage Analysis</h4>
        <div class="stat-row">
            <span class="stat-label">Largest Coverage Gap:</span>
            <span class="stat-value">${coverageGaps.largestGapRegion}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Most Concentrated Area:</span>
            <span class="stat-value">${coverageGaps.mostConcentratedRegion}</span>
        </div>
    `;
    
    // Create chart for regional distribution
    createCoverageChart(regionDistribution, coverageMetrics.gridDistribution);
    
    // Visualize coverage on the map if requested
    if (visualize) {
        visualizeCoverage(positions, coverageGaps);
    }
}

// Calculate coverage metrics
function calculateCoverageMetrics(positions) {
    // Earth's surface area in square km
    const earthSurfaceArea = 510100000; // 510.1 million km²
    
    // Calculate base coverage metrics
    const density = positions.length / (earthSurfaceArea / 1000000); // Balloons per million km²
    
    // Generate a grid of the Earth for analysis
    const grid = generateEarthGrid(15, 30); // 15° latitude, 30° longitude grid
    
    // Mark grid cells that contain balloons
    positions.forEach(pos => {
        const [lat, lng] = pos;
        const latIndex = Math.floor((90 + lat) / 15);
        const lngIndex = Math.floor((180 + lng) / 30);
        
        if (latIndex >= 0 && latIndex < 12 && lngIndex >= 0 && lngIndex < 12) {
            grid[latIndex][lngIndex].count++;
            grid[latIndex][lngIndex].covered = true;
        }
    });
    
    // Calculate coverage percentage based on grid
    let coveredCells = 0;
    let totalCells = 0;
    let maxGapDistance = 0;
    let maxGapLat = 0;
    let maxGapLng = 0;
    
    // For visualization: count distribution across grid
    const gridDistribution = [];
    
    for (let latIndex = 0; latIndex < 12; latIndex++) {
        for (let lngIndex = 0; lngIndex < 12; lngIndex++) {
            const cell = grid[latIndex][lngIndex];
            
            // Calculate cell weight based on latitude (cells are smaller near poles)
            const latCenter = -90 + (latIndex * 15) + 7.5;
            const cellWeight = Math.cos(latCenter * Math.PI / 180);
            
            totalCells += cellWeight;
            if (cell.covered) {
                coveredCells += cellWeight;
            } else {
                // Check if this is potentially part of a large gap
                const gapSize = estimateGapSize(grid, latIndex, lngIndex);
                if (gapSize > maxGapDistance) {
                    maxGapDistance = gapSize;
                    maxGapLat = -90 + (latIndex * 15) + 7.5;
                    maxGapLng = -180 + (lngIndex * 30) + 15;
                }
            }
            
            // Add to distribution data for visualization
            gridDistribution.push({
                lat: -90 + (latIndex * 15) + 7.5,
                lng: -180 + (lngIndex * 30) + 15,
                count: cell.count,
                covered: cell.covered
            });
        }
    }
    
    const coveredPercentage = (coveredCells / totalCells) * 100;
    
    return {
        density,
        coveredPercentage,
        maxGapDistance: maxGapDistance,
        maxGapLocation: { lat: maxGapLat, lng: maxGapLng },
        gridDistribution
    };
}

// Generate a grid of the Earth for analysis
function generateEarthGrid(latStep, lngStep) {
    const grid = [];
    
    for (let lat = -90; lat < 90; lat += latStep) {
        const row = [];
        for (let lng = -180; lng < 180; lng += lngStep) {
            row.push({
                covered: false,
                count: 0,
                lat,
                lng
            });
        }
        grid.push(row);
    }
    
    return grid;
}

// Estimate the size of a gap in km
function estimateGapSize(grid, latIndex, lngIndex) {
    // Find nearest covered cell
    let minDistance = Infinity;
    
    for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
            if (grid[i][j].covered) {
                const lat1 = -90 + (latIndex * 15) + 7.5;
                const lng1 = -180 + (lngIndex * 30) + 15;
                const lat2 = -90 + (i * 15) + 7.5;
                const lng2 = -180 + (j * 30) + 15;
                
                const distance = haversineDistance(lat1, lng1, lat2, lng2);
                minDistance = Math.min(minDistance, distance);
            }
        }
    }
    
    return minDistance;
}

// Calculate regional distribution of balloons
function calculateRegionalDistribution(positions) {
    const northern = positions.filter(pos => pos[0] > 0).length;
    const southern = positions.filter(pos => pos[0] <= 0).length;
    const equatorial = positions.filter(pos => Math.abs(pos[0]) <= 23.5).length;
    const polar = positions.filter(pos => Math.abs(pos[0]) >= 66.5).length;
    const temperate = positions.length - equatorial - polar;
    
    return {
        northern,
        southern,
        equatorial,
        polar,
        temperate,
        northernPercent: (northern / positions.length) * 100,
        southernPercent: (southern / positions.length) * 100,
        equatorialPercent: (equatorial / positions.length) * 100,
        polarPercent: (polar / positions.length) * 100,
        temperatePercent: (temperate / positions.length) * 100
    };
}

// Identify coverage gaps
function identifyCoverageGaps(positions) {
    // Create a grid to identify regions
    const grid = generateEarthGrid(30, 30); // Coarser grid for region naming
    const regions = [
        'North Pacific', 'North Atlantic', 'Arctic', 'Northern Europe', 
        'Russia', 'North America', 'Central Asia', 'East Asia',
        'South Pacific', 'South Atlantic', 'Antarctica', 'Africa',
        'Middle East', 'South America', 'Australia', 'Indian Ocean'
    ];
    
    // Map grid cells to named regions (simplified mapping)
    const regionMap = [
        [8, 0, 2, 3, 4, 5, 6, 7, 7, 8, 8, 8],
        [8, 0, 2, 3, 4, 5, 6, 7, 7, 8, 8, 8],
        [0, 0, 1, 3, 4, 5, 6, 7, 0, 0, 0, 0],
        [0, 0, 1, 11, 12, 5, 13, 7, 0, 0, 0, 0],
        [15, 15, 11, 11, 12, 13, 13, 15, 15, 15, 15, 15],
        [15, 15, 11, 11, 12, 13, 13, 15, 15, 15, 15, 15],
        [9, 9, 11, 11, 12, 13, 14, 15, 8, 8, 8, 9],
        [9, 9, 9, 10, 10, 10, 14, 14, 8, 8, 8, 9],
        [9, 9, 9, 10, 10, 10, 10, 10, 10, 9, 9, 9]
    ];
    
    // Count balloons in each region
    const regionCounts = Array(regions.length).fill(0);
    
    positions.forEach(pos => {
        const [lat, lng] = pos;
        const latIndex = Math.min(Math.floor((90 + lat) / 20), 8);
        const lngIndex = Math.min(Math.floor((180 + lng) / 30), 11);
        
        if (latIndex >= 0 && latIndex < regionMap.length && 
            lngIndex >= 0 && lngIndex < regionMap[0].length) {
            const regionIndex = regionMap[latIndex][lngIndex];
            regionCounts[regionIndex]++;
        }
    });
    
    // Find regions with lowest and highest coverage
    let minRegion = 0;
    let maxRegion = 0;
    
    for (let i = 0; i < regionCounts.length; i++) {
        if (regionCounts[i] < regionCounts[minRegion]) minRegion = i;
        if (regionCounts[i] > regionCounts[maxRegion]) maxRegion = i;
    }
    
    return {
        largestGapRegion: `${regions[minRegion]} (${regionCounts[minRegion]} balloons)`,
        mostConcentratedRegion: `${regions[maxRegion]} (${regionCounts[maxRegion]} balloons)`,
        regionCounts
    };
}

// Calculate the distance between two points on Earth using the Haversine formula
function haversineDistance(lat1, lon1, lat2, lon2) {
    // Earth's radius in kilometers
    const R = 6371;
    
    // Convert degrees to radians
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    // Haversine formula
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
}

// Create chart for coverage distribution
function createCoverageChart(regionDistribution, gridDistribution) {
    // Get the canvas element
    const ctx = document.getElementById('statsChart');
    
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create tabs for different charts
    const chartOptions = `
        <div style="margin-bottom: 10px;">
            <label>
                <input type="radio" name="chartType" value="hemispheres" checked> Hemispheres
            </label>
            <label style="margin-left: 10px;">
                <input type="radio" name="chartType" value="latitudinal"> Latitudinal Bands
            </label>
        </div>
    `;
    
    // Add options before chart
    const chartContainer = document.querySelector('.chart-container');
    const existingOptions = chartContainer.querySelector('.chart-options');
    
    if (existingOptions) {
        existingOptions.innerHTML = chartOptions;
    } else {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'chart-options';
        optionsDiv.innerHTML = chartOptions;
        chartContainer.insertBefore(optionsDiv, ctx);
    }
    
    // Create hemispheres chart by default
    createHemispheresChart(ctx, regionDistribution);
    
    // Add event listeners for chart type radio buttons
    document.querySelectorAll('input[name="chartType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'hemispheres') {
                createHemispheresChart(ctx, regionDistribution);
            } else {
                createLatitudinalChart(ctx, regionDistribution);
            }
        });
    });
}

// Create hemispheres chart
function createHemispheresChart(ctx, regionDistribution) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Northern Hemisphere', 'Southern Hemisphere'],
            datasets: [{
                data: [
                    regionDistribution.northern,
                    regionDistribution.southern
                ],
                backgroundColor: [
                    'rgba(66, 133, 244, 0.6)',
                    'rgba(234, 67, 53, 0.6)'
                ],
                borderColor: [
                    'rgba(66, 133, 244, 1)',
                    'rgba(234, 67, 53, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Balloon Distribution by Hemisphere'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} balloons (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Create latitudinal chart
function createLatitudinalChart(ctx, regionDistribution) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Polar Regions', 'Temperate Zones', 'Equatorial Region'],
            datasets: [{
                label: 'Balloon Count',
                data: [
                    regionDistribution.polar,
                    regionDistribution.temperate,
                    regionDistribution.equatorial
                ],
                backgroundColor: [
                    'rgba(66, 133, 244, 0.6)',
                    'rgba(251, 188, 5, 0.6)',
                    'rgba(234, 67, 53, 0.6)'
                ],
                borderColor: [
                    'rgba(66, 133, 244, 1)',
                    'rgba(251, 188, 5, 1)',
                    'rgba(234, 67, 53, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Balloons'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Latitudinal Bands'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Balloon Distribution by Latitude'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} balloons (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Visualize coverage on the map
function visualizeCoverage(positions, coverageData) {
    if (!positions || positions.length === 0) return;
    
    const { grid, coveragePercentage, gapDistribution } = coverageData;
    
    // Create grid visualization
    grid.forEach(cell => {
        if (cell.covered) {
            const cellMarker = L.rectangle(
                [[cell.latMin, cell.lngMin], [cell.latMax, cell.lngMax]], 
                {
                    color: '#3388ff',
                    weight: 1,
                    fillColor: '#3388ff',
                    fillOpacity: 0.05
                }
            ).addTo(map);
            
            statsOverlays.push(cellMarker);
        } else {
            // For uncovered cells, show a red outline
            const gapMarker = L.rectangle(
                [[cell.latMin, cell.lngMin], [cell.latMax, cell.lngMax]], 
                {
                    color: '#ff3333',
                    weight: 1,
                    fillColor: '#ff3333',
                    fillOpacity: 0.05
                }
            ).addTo(map);
            
            statsOverlays.push(gapMarker);
        }
    });
    
    // Add balloons as markers
    positions.forEach((pos, index) => {
        const [lat, lng, altitude] = pos;
        
        const marker = L.circleMarker([lat, lng], {
            radius: currentMarkerSize,
            fillColor: '#3388ff',
            color: '#ffffff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.6
        }).addTo(map);
        
        marker.bindPopup(`
            <strong>Balloon at ${lat.toFixed(3)}, ${lng.toFixed(3)}</strong><br>
            Altitude: ${altitude.toFixed(2)} km
        `);
        
        statsOverlays.push(marker);
    });
    
    // Add a legend
    coverageLegend = L.control({ position: 'bottomright' });
    
    coverageLegend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';
        div.style.maxWidth = '200px';
        
        div.innerHTML = `
            <h4 style="margin:0 0 5px 0">Coverage Analysis</h4>
            <div style="display:flex;align-items:center;margin-bottom:3px;">
                <div style="width:15px;height:15px;background-color:#3388ff;opacity:0.6;border-radius:50%;margin-right:5px;"></div>
                <span>Balloon Location</span>
            </div>
            <div style="display:flex;align-items:center;margin-bottom:3px;">
                <div style="width:15px;height:15px;border:1px solid #3388ff;background-color:#3388ff;opacity:0.1;margin-right:5px;"></div>
                <span>Covered Area</span>
            </div>
            <div style="display:flex;align-items:center;margin-bottom:10px;">
                <div style="width:15px;height:15px;border:1px solid #ff3333;background-color:#ff3333;opacity:0.1;margin-right:5px;"></div>
                <span>Coverage Gap</span>
            </div>
            <div style="border-top: 1px solid #ccc; padding-top: 5px;">
                <strong>Global Coverage:</strong> ${coveragePercentage.toFixed(1)}%
            </div>
        `;
        
        return div;
    };
    
    coverageLegend.addTo(map);
    statsOverlays.push(coverageLegend);
}

// Display density statistics
function displayDensityStatistics(timeData, visualize) {
    const positions = timeData.positions;
    
    // Calculate density metrics
    const densityMetrics = calculateDensityMetrics(positions);
    
    // Calculate clustering metrics
    const clusteringMetrics = calculateClusteringMetrics(positions);
    
    // Calculate density distribution
    const densityDistribution = calculateDensityDistribution(positions);
    
    // Display stats in the numbers tab
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = `
        <h4>Global Density Metrics</h4>
        <div class="stat-row">
            <span class="stat-label">Global Mean Distance:</span>
            <span class="stat-value">${densityMetrics.meanDistance.toFixed(0)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Distance Deviation:</span>
            <span class="stat-value">±${densityMetrics.stdDevDistance.toFixed(0)} km</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Nearest Neighbor Avg:</span>
            <span class="stat-value">${densityMetrics.nearestNeighborAvg.toFixed(0)} km</span>
        </div>
        
        <h4>Clustering Analysis</h4>
        <div class="stat-row">
            <span class="stat-label">Cluster Count:</span>
            <span class="stat-value">${clusteringMetrics.clusterCount}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Avg Cluster Size:</span>
            <span class="stat-value">${clusteringMetrics.avgClusterSize.toFixed(1)} balloons</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Isolation Index:</span>
            <span class="stat-value">${clusteringMetrics.isolationIndex.toFixed(2)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Largest Cluster:</span>
            <span class="stat-value">${clusteringMetrics.largestCluster} balloons</span>
        </div>
        
        <h4>Density Hotspots</h4>
        <div class="stat-row">
            <span class="stat-label">Highest Density Area:</span>
            <span class="stat-value">${densityDistribution.highestDensityRegion}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Most Isolated Balloon:</span>
            <span class="stat-value">${densityDistribution.mostIsolatedRegion}</span>
        </div>
    `;
    
    // Create chart for density distribution
    createDensityChart(densityDistribution);
    
    // Visualize density on the map if requested
    if (visualize) {
        visualizeDensity(positions, densityDistribution, clusteringMetrics);
    }
}

// Calculate density metrics
function calculateDensityMetrics(positions) {
    // Initialize metrics
    let totalDistance = 0;
    let distanceSquaredSum = 0;
    let distanceCount = 0;
    let nearestNeighborSum = 0;
    
    // Calculate pairwise distances between all balloons
    for (let i = 0; i < positions.length; i++) {
        let nearestDistance = Infinity;
        
        for (let j = 0; j < positions.length; j++) {
            if (i !== j) {
                const distance = haversineDistance(
                    positions[i][0], positions[i][1],
                    positions[j][0], positions[j][1]
                );
                
                totalDistance += distance;
                distanceSquaredSum += distance * distance;
                distanceCount++;
                
                // Track nearest neighbor
                nearestDistance = Math.min(nearestDistance, distance);
            }
        }
        
        // Add to nearest neighbor sum
        if (nearestDistance !== Infinity) {
            nearestNeighborSum += nearestDistance;
        }
    }
    
    // Calculate metrics
    const meanDistance = distanceCount > 0 ? totalDistance / distanceCount : 0;
    const variance = distanceCount > 0 ? (distanceSquaredSum / distanceCount) - (meanDistance * meanDistance) : 0;
    const stdDevDistance = Math.sqrt(Math.max(0, variance));
    const nearestNeighborAvg = positions.length > 0 ? nearestNeighborSum / positions.length : 0;
    
    return {
        meanDistance,
        stdDevDistance,
        nearestNeighborAvg
    };
}

// Calculate clustering metrics using DBSCAN-inspired approach
function calculateClusteringMetrics(positions) {
    if (positions.length === 0) {
        return {
            clusterCount: 0,
            avgClusterSize: 0,
            isolationIndex: 0,
            largestCluster: 0
        };
    }
    
    // Parameters for clustering
    const epsilon = 500; // km - maximum distance to be considered part of a cluster
    const minPoints = 3; // minimum points to form a cluster
    
    // Track which points have been visited
    const visited = new Array(positions.length).fill(false);
    const clusterAssignments = new Array(positions.length).fill(-1); // -1 = noise
    
    let clusterCount = 0;
    
    // Function to get neighbors within epsilon distance
    const getNeighbors = (pointIndex) => {
        const neighbors = [];
        
        for (let i = 0; i < positions.length; i++) {
            if (i !== pointIndex) {
                const distance = haversineDistance(
                    positions[pointIndex][0], positions[pointIndex][1],
                    positions[i][0], positions[i][1]
                );
                
                if (distance <= epsilon) {
                    neighbors.push(i);
                }
            }
        }
        
        return neighbors;
    };
    
    // DBSCAN algorithm
    for (let i = 0; i < positions.length; i++) {
        if (visited[i]) continue;
        
        visited[i] = true;
        const neighbors = getNeighbors(i);
        
        if (neighbors.length < minPoints - 1) {
            // Mark as noise
            clusterAssignments[i] = -1;
        } else {
            // Start a new cluster
            const clusterId = clusterCount++;
            clusterAssignments[i] = clusterId;
            
            // Expand cluster
            const seedSet = [...neighbors];
            for (let j = 0; j < seedSet.length; j++) {
                const currentPoint = seedSet[j];
                
                if (!visited[currentPoint]) {
                    visited[currentPoint] = true;
                    const pointNeighbors = getNeighbors(currentPoint);
                    
                    if (pointNeighbors.length >= minPoints - 1) {
                        // Add new neighbors to seed set
                        for (const neighbor of pointNeighbors) {
                            if (!visited[neighbor] && !seedSet.includes(neighbor)) {
                                seedSet.push(neighbor);
                            }
                        }
                    }
                }
                
                // Add to cluster if not already in one
                if (clusterAssignments[currentPoint] === -1) {
                    clusterAssignments[currentPoint] = clusterId;
                }
            }
        }
    }
    
    // Calculate cluster sizes
    const clusterSizes = new Array(clusterCount).fill(0);
    let noiseCount = 0;
    
    for (const assignment of clusterAssignments) {
        if (assignment === -1) {
            noiseCount++;
        } else {
            clusterSizes[assignment]++;
        }
    }
    
    // Calculate metrics
    const totalInClusters = positions.length - noiseCount;
    const avgClusterSize = clusterCount > 0 ? totalInClusters / clusterCount : 0;
    const isolationIndex = positions.length > 0 ? noiseCount / positions.length : 0;
    const largestCluster = clusterSizes.length > 0 ? Math.max(...clusterSizes) : 0;
    
    return {
        clusterCount,
        avgClusterSize,
        isolationIndex,
        largestCluster,
        clusterAssignments,
        clusterSizes
    };
}

// Calculate density distribution metrics
function calculateDensityDistribution(positions) {
    if (positions.length === 0) {
        return {
            highestDensityRegion: "N/A",
            mostIsolatedRegion: "N/A",
            densityMap: []
        };
    }
    
    // Create a grid for density analysis
    const gridSize = 10; // degrees
    const grid = [];
    
    for (let lat = -90; lat < 90; lat += gridSize) {
        for (let lng = -180; lng < 180; lng += gridSize) {
            grid.push({
                lat: lat + gridSize / 2,
                lng: lng + gridSize / 2,
                count: 0,
                region: getRegionName(lat + gridSize / 2, lng + gridSize / 2)
            });
        }
    }
    
    // Count balloons in each grid cell
    positions.forEach(pos => {
        const [lat, lng] = pos;
        
        // Find the cell this position belongs to
        let nearestCell = null;
        let minDistance = Infinity;
        
        for (const cell of grid) {
            const latDiff = Math.abs(cell.lat - lat);
            const lngDiff = Math.min(Math.abs(cell.lng - lng), 360 - Math.abs(cell.lng - lng));
            const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestCell = cell;
            }
        }
        
        if (nearestCell) {
            nearestCell.count++;
        }
    });
    
    // Find highest and lowest density cells (with balloons)
    let highestDensityCell = grid[0];
    let lowestDensityCell = null;
    
    for (const cell of grid) {
        if (cell.count > highestDensityCell.count) {
            highestDensityCell = cell;
        }
        
        if (cell.count > 0 && (!lowestDensityCell || cell.count < lowestDensityCell.count)) {
            lowestDensityCell = cell;
        }
    }
    
    // Calculate distances from each balloon to nearest neighbor
    const isolationScores = positions.map((pos, idx) => {
        let nearestDistance = Infinity;
        
        for (let j = 0; j < positions.length; j++) {
            if (idx !== j) {
                const distance = haversineDistance(
                    pos[0], pos[1],
                    positions[j][0], positions[j][1]
                );
                
                nearestDistance = Math.min(nearestDistance, distance);
            }
        }
        
        return {
            position: pos,
            distance: nearestDistance,
            region: getRegionName(pos[0], pos[1])
        };
    });
    
    // Find most isolated balloon
    const mostIsolated = isolationScores.reduce((most, current) => 
        current.distance > most.distance ? current : most, 
        { distance: -Infinity });
    
    return {
        highestDensityRegion: `${highestDensityCell.region} (${highestDensityCell.count} balloons)`,
        mostIsolatedRegion: `${mostIsolated.region} (${mostIsolated.distance.toFixed(0)} km to nearest)`,
        densityMap: grid.filter(cell => cell.count > 0),
        isolationScores
    };
}

// Get region name from latitude and longitude
function getRegionName(lat, lng) {
    // Define major world regions
    const regions = [
        { name: 'North America', lat: [15, 70], lng: [-170, -50] },
        { name: 'South America', lat: [-60, 15], lng: [-90, -30] },
        { name: 'Europe', lat: [35, 70], lng: [-10, 40] },
        { name: 'Africa', lat: [-40, 35], lng: [-20, 50] },
        { name: 'Asia', lat: [0, 70], lng: [40, 150] },
        { name: 'Australia/Oceania', lat: [-50, 0], lng: [110, 180] },
        { name: 'Antarctica', lat: [-90, -60], lng: [-180, 180] },
        { name: 'Arctic', lat: [70, 90], lng: [-180, 180] },
        { name: 'North Atlantic', lat: [0, 70], lng: [-80, -10] },
        { name: 'South Atlantic', lat: [-60, 0], lng: [-70, 20] },
        { name: 'North Pacific', lat: [0, 70], lng: [150, -170] },
        { name: 'South Pacific', lat: [-60, 0], lng: [150, -70] },
        { name: 'Indian Ocean', lat: [-60, 30], lng: [50, 110] }
    ];
    
    // Find matching region
    for (const region of regions) {
        if (lat >= region.lat[0] && lat <= region.lat[1]) {
            // Handle the special case of longitude ranges that cross the antimeridian
            if (region.lng[0] > region.lng[1]) {
                if (lng >= region.lng[0] || lng <= region.lng[1]) {
                    return region.name;
                }
            } else if (lng >= region.lng[0] && lng <= region.lng[1]) {
                return region.name;
            }
        }
    }
    
    return 'Open Ocean';
}

// Create chart for density distribution
function createDensityChart(densityDistribution) {
    // Get the canvas element
    const ctx = document.getElementById('statsChart');
    
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create tabs for different charts
    const chartOptions = `
        <div style="margin-bottom: 10px;">
            <label>
                <input type="radio" name="chartType" value="density" checked> Density Histogram
            </label>
            <label style="margin-left: 10px;">
                <input type="radio" name="chartType" value="isolation"> Isolation Distribution
            </label>
        </div>
    `;
    
    // Add options before chart
    const chartContainer = document.querySelector('.chart-container');
    const existingOptions = chartContainer.querySelector('.chart-options');
    
    if (existingOptions) {
        existingOptions.innerHTML = chartOptions;
    } else {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'chart-options';
        optionsDiv.innerHTML = chartOptions;
        chartContainer.insertBefore(optionsDiv, ctx);
    }
    
    // Prepare data for density histogram
    const densityCounts = {};
    densityDistribution.densityMap.forEach(cell => {
        densityCounts[cell.count] = (densityCounts[cell.count] || 0) + 1;
    });
    
    const densityLabels = Object.keys(densityCounts).sort((a, b) => parseInt(a) - parseInt(b));
    const densityValues = densityLabels.map(count => densityCounts[count]);
    
    // Create density histogram by default
    createDensityHistogram(ctx, densityLabels, densityValues);
    
    // Add event listeners for chart type radio buttons
    document.querySelectorAll('input[name="chartType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'density') {
                createDensityHistogram(ctx, densityLabels, densityValues);
            } else {
                createIsolationChart(ctx, densityDistribution.isolationScores);
            }
        });
    });
}

// Create density histogram chart
function createDensityHistogram(ctx, labels, values) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Regions',
                data: values,
                backgroundColor: 'rgba(66, 133, 244, 0.6)',
                borderColor: 'rgba(66, 133, 244, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Regions'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Balloons per Region'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Balloon Density Distribution'
                }
            }
        }
    });
}

// Create isolation distance chart
function createIsolationChart(ctx, isolationScores) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create bins for isolation distances
    const distances = isolationScores.map(score => score.distance);
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    const range = max - min;
    const binSize = range / 10; // 10 bins
    
    const bins = Array(10).fill(0);
    
    // Count distances in each bin
    distances.forEach(distance => {
        const binIndex = Math.min(Math.floor((distance - min) / binSize), 9);
        bins[binIndex]++;
    });
    
    // Create labels for bins
    const labels = bins.map((_, i) => {
        const start = min + (i * binSize);
        const end = min + ((i + 1) * binSize);
        return `${start.toFixed(0)}-${end.toFixed(0)} km`;
    });
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Balloons',
                data: bins,
                backgroundColor: 'rgba(234, 67, 53, 0.6)',
                borderColor: 'rgba(234, 67, 53, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Balloons'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Distance to Nearest Neighbor (km)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Balloon Isolation Distribution'
                }
            }
        }
    });
}

// Visualize density on the map
function visualizeDensity(positions, densityDistribution, clusteringMetrics) {
    // 1. Visualize clusters with different colors
    if (clusteringMetrics.clusterCount > 0) {
        const clusterColors = generateClusterColors(clusteringMetrics.clusterCount);
        
        // Draw balloons colored by cluster
        positions.forEach((pos, index) => {
            const [lat, lng, altitude] = pos;
            const clusterID = clusteringMetrics.clusterAssignments[index];
            
            // Determine color (noise points are gray)
            const color = clusterID === -1 ? '#888888' : clusterColors[clusterID];
            
            // Create marker
            const marker = L.circleMarker([lat, lng], {
                radius: currentMarkerSize * 1.2,
                fillColor: color,
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.7
            }).addTo(map);
            
            // Add popup with cluster info
            marker.bindPopup(`
                <strong>Balloon at ${lat.toFixed(3)}, ${lng.toFixed(3)}</strong><br>
                Altitude: ${altitude.toFixed(2)} km<br>
                ${clusterID === -1 ? 'Isolated balloon (not in a cluster)' : `Member of Cluster #${clusterID + 1}`}
            `);
            
            // Add to overlays array
            statsOverlays.push(marker);
        });
        
        // 2. Add density heatmap layer
        // First normalize the counts
        const counts = densityDistribution.densityMap.map(cell => cell.count);
        const maxCount = Math.max(...counts);
        
        // Add heatmap circles with radius based on count
        densityDistribution.densityMap.forEach(cell => {
            if (cell.count > 0) {
                const normalizedCount = cell.count / maxCount;
                const radius = normalizedCount * 100000; // scale for visibility
                
                const circle = L.circle([cell.lat, cell.lng], {
                    radius: radius,
                    fillColor: '#ff3300',
                    color: 'transparent',
                    fillOpacity: 0.15
                }).addTo(map);
                
                statsOverlays.push(circle);
            }
        });
        
        // 3. Add a legend
        densityLegend = L.control({ position: 'bottomright' });
        
        densityLegend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            div.style.backgroundColor = 'white';
            div.style.padding = '10px';
            div.style.borderRadius = '5px';
            div.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';
            div.style.maxHeight = '400px'; // Maximum height for the legend
            div.style.width = '220px'; // Fixed width to accommodate cluster names
            div.style.overflowY = 'auto'; // Make it scrollable vertically
            
            div.innerHTML = '<h4 style="margin:0 0 5px 0;position:sticky;top:0;background:white;padding-bottom:5px;z-index:1;">Cluster Analysis</h4>';
            
            // Create a container for the scrollable content
            const scrollContainer = document.createElement('div');
            scrollContainer.style.maxHeight = '300px'; // Adjust as needed
            scrollContainer.style.overflowY = 'auto';
            scrollContainer.style.marginBottom = '10px';
            
            // Add cluster colors
            let legendContent = '';
            
            for (let i = 0; i < clusteringMetrics.clusterCount; i++) {
                const size = clusteringMetrics.clusterSizes[i];
                legendContent += `
                    <div style="display:flex;align-items:center;margin-bottom:3px;">
                        <div style="width:15px;height:15px;background-color:${clusterColors[i]};border-radius:50%;margin-right:5px;flex-shrink:0;"></div>
                        <span>Cluster #${i + 1} (${size} balloons)</span>
                    </div>
                `;
            }
            
            // Add isolated points
            const isolatedCount = positions.length - clusteringMetrics.clusterSizes.reduce((a, b) => a + b, 0);
            if (isolatedCount > 0) {
                legendContent += `
                    <div style="display:flex;align-items:center;margin-bottom:3px;">
                        <div style="width:15px;height:15px;background-color:#888888;border-radius:50%;margin-right:5px;flex-shrink:0;"></div>
                        <span>Isolated (${isolatedCount} balloons)</span>
                    </div>
                `;
            }
            
            scrollContainer.innerHTML = legendContent;
            div.appendChild(scrollContainer);
            
            // Add heatmap explanation (sticky at the bottom)
            const heatmapExplanation = document.createElement('div');
            heatmapExplanation.style.position = 'sticky';
            heatmapExplanation.style.bottom = '0';
            heatmapExplanation.style.background = 'white';
            heatmapExplanation.style.paddingTop = '5px';
            heatmapExplanation.style.borderTop = '1px solid #ccc';
            heatmapExplanation.style.zIndex = '1';
            
            heatmapExplanation.innerHTML = `
                <div style="height:10px;background:linear-gradient(to right, rgba(255,51,0,0.1), rgba(255,51,0,0.7));margin-bottom:3px;"></div>
                <div style="display:flex;justify-content:space-between;">
                    <span>Low Density</span>
                    <span>High Density</span>
                </div>
            `;
            
            div.appendChild(heatmapExplanation);
            
            return div;
        };
        
        densityLegend.addTo(map);
        statsOverlays.push(densityLegend);
    }
}

// Generate distinct colors for clusters
function generateClusterColors(count) {
    const colors = [];
    
    // Pre-defined colors for up to 10 clusters
    const baseColors = [
        '#e6194B', '#3cb44b', '#4363d8', '#f58231', '#911eb4', 
        '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990'
    ];
    
    // Use pre-defined colors for small number of clusters
    if (count <= baseColors.length) {
        return baseColors.slice(0, count);
    }
    
    // Generate colors based on HSL for more clusters
    for (let i = 0; i < count; i++) {
        const hue = (i * 360 / count) % 360;
        colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    
    return colors;
}

// Display cluster statistics
function displayClusterStatistics(timeData, visualize) {
    const positions = timeData.positions;
    
    // Perform k-means clustering with automatic k detection
    const kMeansResults = performKMeansClustering(positions);
    
    // Calculate cluster metrics
    const clusterMetrics = calculateClusterMetrics(positions, kMeansResults);
    
    // Display stats in the numbers tab
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = `
        <h4>K-Means Clustering</h4>
        <div class="stat-row">
            <span class="stat-label">Optimal Clusters (k):</span>
            <span class="stat-value">${kMeansResults.k}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Silhouette Score:</span>
            <span class="stat-value">${clusterMetrics.silhouetteScore.toFixed(3)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Average Distance to Centroid:</span>
            <span class="stat-value">${clusterMetrics.avgDistanceToCentroid.toFixed(1)} km</span>
        </div>
        
        <h4>Cluster Distribution</h4>
        <div class="stat-row">
            <span class="stat-label">Largest Cluster:</span>
            <span class="stat-value">${clusterMetrics.largestCluster} balloons</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Smallest Cluster:</span>
            <span class="stat-value">${clusterMetrics.smallestCluster} balloons</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Avg. Inter-Cluster Distance:</span>
            <span class="stat-value">${clusterMetrics.avgInterClusterDistance.toFixed(1)} km</span>
        </div>
        
        <h4>Cluster Stability</h4>
        <div class="stat-row">
            <span class="stat-label">Cluster Quality:</span>
            <span class="stat-value">${getClusterQualityDescription(clusterMetrics.silhouetteScore)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Variance Explained:</span>
            <span class="stat-value">${(clusterMetrics.varianceExplained * 100).toFixed(1)}%</span>
        </div>
    `;
    
    // Create chart for clustering visualization
    createClusteringChart(kMeansResults, clusterMetrics);
    
    // Visualize clusters on the map if requested
    if (visualize) {
        visualizeClusters(positions, kMeansResults);
    }
}

// Perform k-means clustering with automatic k detection
function performKMeansClustering(positions) {
    if (positions.length === 0) {
        return {
            k: 0,
            assignments: [],
            centroids: [],
            clusterSizes: []
        };
    }
    
    // Find optimal k using the Elbow method
    // Try k from 2 to min(20, positions.length/10)
    const maxK = Math.min(20, Math.floor(positions.length / 10));
    const kRange = Array.from({length: maxK - 1}, (_, i) => i + 2);
    
    let optimalK = 2;
    let bestScore = -Infinity;
    let finalAssignments = [];
    let finalCentroids = [];
    let finalClusterSizes = [];
    
    // Try each k and track silhouette scores
    const silhouetteScores = [];
    const inertiaValues = [];
    
    for (const k of kRange) {
        // Run k-means for this k
        const {assignments, centroids, inertia} = kMeansCluster(positions, k);
        
        // Calculate silhouette score
        const silhouetteScore = calculateSilhouetteScore(positions, assignments, centroids);
        silhouetteScores.push(silhouetteScore);
        inertiaValues.push(inertia);
        
        // Track the k with best silhouette score
        if (silhouetteScore > bestScore) {
            bestScore = silhouetteScore;
            optimalK = k;
            finalAssignments = assignments;
            finalCentroids = centroids;
            
            // Calculate cluster sizes
            finalClusterSizes = new Array(k).fill(0);
            for (const assignment of assignments) {
                finalClusterSizes[assignment]++;
            }
        }
    }
    
    return {
        k: optimalK,
        assignments: finalAssignments,
        centroids: finalCentroids,
        clusterSizes: finalClusterSizes,
        silhouetteScores,
        inertiaValues,
        kRange
    };
}

// Implement k-means clustering algorithm
function kMeansCluster(positions, k) {
    if (positions.length === 0 || k <= 0) {
        return {
            assignments: [],
            centroids: [],
            inertia: 0
        };
    }
    
    // Extract coordinates for clustering (ignore altitude)
    const points = positions.map(pos => [pos[0], pos[1]]);
    
    // Initialize centroids using k-means++ method
    let centroids = initializeCentroids(points, k);
    
    // Max iterations for k-means
    const maxIterations = 100;
    let iterations = 0;
    let oldAssignments = new Array(points.length).fill(-1);
    let assignments = new Array(points.length).fill(-1);
    let converged = false;
    
    // Run k-means algorithm
    while (!converged && iterations < maxIterations) {
        // Assign points to clusters
        for (let i = 0; i < points.length; i++) {
            let minDistance = Infinity;
            let closestCentroid = 0;
            
            for (let j = 0; j < centroids.length; j++) {
                const distance = haversineDistance(
                    points[i][0], points[i][1],
                    centroids[j][0], centroids[j][1]
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCentroid = j;
                }
            }
            
            assignments[i] = closestCentroid;
        }
        
        // Check for convergence (no change in assignments)
        converged = true;
        for (let i = 0; i < points.length; i++) {
            if (assignments[i] !== oldAssignments[i]) {
                converged = false;
                break;
            }
        }
        
        if (converged) break;
        
        // Update old assignments
        oldAssignments = [...assignments];
        
        // Update centroids
        const newCentroids = new Array(k).fill().map(() => [0, 0]);
        const counts = new Array(k).fill(0);
        
        for (let i = 0; i < points.length; i++) {
            const clusterId = assignments[i];
            newCentroids[clusterId][0] += points[i][0];
            newCentroids[clusterId][1] += points[i][1];
            counts[clusterId]++;
        }
        
        // Calculate new centroid positions
        for (let i = 0; i < k; i++) {
            if (counts[i] > 0) {
                centroids[i][0] = newCentroids[i][0] / counts[i];
                centroids[i][1] = newCentroids[i][1] / counts[i];
            }
        }
        
        iterations++;
    }
    
    // Calculate final inertia (sum of squared distances to centroids)
    let inertia = 0;
    for (let i = 0; i < points.length; i++) {
        const clusterId = assignments[i];
        const distance = haversineDistance(
            points[i][0], points[i][1],
            centroids[clusterId][0], centroids[clusterId][1]
        );
        inertia += distance * distance;
    }
    
    return {
        assignments,
        centroids,
        inertia
    };
}

// Initialize centroids using k-means++ method
function initializeCentroids(points, k) {
    if (points.length === 0 || k <= 0) {
        return [];
    }
    
    // Initialize with one random centroid
    const centroids = [];
    const firstCentroid = Math.floor(Math.random() * points.length);
    centroids.push([...points[firstCentroid]]);
    
    // Choose remaining centroids using k-means++ method
    for (let i = 1; i < k; i++) {
        // Calculate squared distances to nearest centroids
        const distances = points.map(point => {
            let minDistance = Infinity;
            
            for (const centroid of centroids) {
                const distance = haversineDistance(
                    point[0], point[1],
                    centroid[0], centroid[1]
                );
                minDistance = Math.min(minDistance, distance);
            }
            
            return minDistance * minDistance;
        });
        
        // Calculate probability distribution based on squared distances
        const sum = distances.reduce((a, b) => a + b, 0);
        const probabilities = distances.map(d => d / sum);
        
        // Choose next centroid based on probability distribution
        let cumulativeProbability = 0;
        const randomValue = Math.random();
        let nextCentroid = 0;
        
        for (let j = 0; j < probabilities.length; j++) {
            cumulativeProbability += probabilities[j];
            if (cumulativeProbability >= randomValue) {
                nextCentroid = j;
                break;
            }
        }
        
        centroids.push([...points[nextCentroid]]);
    }
    
    return centroids;
}

// Calculate silhouette score for clustering quality
function calculateSilhouetteScore(positions, assignments, centroids) {
    if (positions.length <= 1 || centroids.length <= 1) {
        return 0;
    }
    
    const silhouetteValues = [];
    
    for (let i = 0; i < positions.length; i++) {
        const a = calculateAverageDistanceToSameCluster(i, positions, assignments);
        const b = calculateAverageDistanceToNearestCluster(i, positions, assignments, centroids);
        
        if (a === 0 && b === 0) {
            silhouetteValues.push(0);
        } else {
            const silhouette = (b - a) / Math.max(a, b);
            silhouetteValues.push(silhouette);
        }
    }
    
    // Calculate average silhouette
    const sum = silhouetteValues.reduce((a, b) => a + b, 0);
    return sum / silhouetteValues.length;
}

// Calculate average distance to points in the same cluster
function calculateAverageDistanceToSameCluster(pointIndex, positions, assignments) {
    const pointCluster = assignments[pointIndex];
    const pointsInSameCluster = positions.filter((_, i) => 
        i !== pointIndex && assignments[i] === pointCluster
    );
    
    if (pointsInSameCluster.length === 0) {
        return 0;
    }
    
    let totalDistance = 0;
    for (const otherPoint of pointsInSameCluster) {
        totalDistance += haversineDistance(
            positions[pointIndex][0], positions[pointIndex][1],
            otherPoint[0], otherPoint[1]
        );
    }
    
    return totalDistance / pointsInSameCluster.length;
}

// Calculate average distance to points in the nearest cluster
function calculateAverageDistanceToNearestCluster(pointIndex, positions, assignments, centroids) {
    const pointCluster = assignments[pointIndex];
    let nearestClusterDistance = Infinity;
    
    // Check each cluster
    for (let clusterId = 0; clusterId < centroids.length; clusterId++) {
        if (clusterId === pointCluster) continue;
        
        const pointsInCluster = positions.filter((_, i) => assignments[i] === clusterId);
        
        if (pointsInCluster.length === 0) continue;
        
        let totalDistance = 0;
        for (const otherPoint of pointsInCluster) {
            totalDistance += haversineDistance(
                positions[pointIndex][0], positions[pointIndex][1],
                otherPoint[0], otherPoint[1]
            );
        }
        
        const avgDistance = totalDistance / pointsInCluster.length;
        nearestClusterDistance = Math.min(nearestClusterDistance, avgDistance);
    }
    
    return nearestClusterDistance === Infinity ? 0 : nearestClusterDistance;
}

// Calculate cluster metrics
function calculateClusterMetrics(positions, kMeansResults) {
    const { k, assignments, centroids, clusterSizes, silhouetteScores } = kMeansResults;
    
    if (positions.length === 0 || k === 0) {
        return {
            silhouetteScore: 0,
            avgDistanceToCentroid: 0,
            largestCluster: 0,
            smallestCluster: 0,
            avgInterClusterDistance: 0,
            varianceExplained: 0
        };
    }
    
    // Calculate average distance to centroid
    let totalDistanceToCentroid = 0;
    for (let i = 0; i < positions.length; i++) {
        const clusterId = assignments[i];
        const distance = haversineDistance(
            positions[i][0], positions[i][1],
            centroids[clusterId][0], centroids[clusterId][1]
        );
        totalDistanceToCentroid += distance;
    }
    const avgDistanceToCentroid = totalDistanceToCentroid / positions.length;
    
    // Calculate largest and smallest clusters
    const largestCluster = Math.max(...clusterSizes);
    const smallestCluster = Math.min(...clusterSizes.filter(size => size > 0));
    
    // Calculate average inter-cluster distance
    let totalInterClusterDistance = 0;
    let pairCount = 0;
    
    for (let i = 0; i < centroids.length; i++) {
        for (let j = i + 1; j < centroids.length; j++) {
            const distance = haversineDistance(
                centroids[i][0], centroids[i][1],
                centroids[j][0], centroids[j][1]
            );
            totalInterClusterDistance += distance;
            pairCount++;
        }
    }
    
    const avgInterClusterDistance = pairCount > 0 ? 
        totalInterClusterDistance / pairCount : 0;
    
    // Calculate variance explained
    // Based on ratio of between-cluster variance to total variance
    const globalCentroid = calculateGlobalCentroid(positions);
    
    // Calculate total variance
    let totalVariance = 0;
    for (const position of positions) {
        const distance = haversineDistance(
            position[0], position[1],
            globalCentroid[0], globalCentroid[1]
        );
        totalVariance += distance * distance;
    }
    
    // Calculate between-cluster variance
    let betweenClusterVariance = 0;
    for (let i = 0; i < centroids.length; i++) {
        const clusterSize = clusterSizes[i];
        if (clusterSize > 0) {
            const distance = haversineDistance(
                centroids[i][0], centroids[i][1],
                globalCentroid[0], globalCentroid[1]
            );
            betweenClusterVariance += clusterSize * distance * distance;
        }
    }
    
    const varianceExplained = totalVariance > 0 ? 
        betweenClusterVariance / totalVariance : 0;
    
    // Calculate silhouette score if not provided
    const silhouetteScore = silhouetteScores && silhouetteScores.length > 0 ? 
        silhouetteScores[k - 2] : calculateSilhouetteScore(positions, assignments, centroids);
    
    return {
        silhouetteScore,
        avgDistanceToCentroid,
        largestCluster,
        smallestCluster,
        avgInterClusterDistance,
        varianceExplained
    };
}

// Calculate global centroid of all points
function calculateGlobalCentroid(positions) {
    if (positions.length === 0) {
        return [0, 0];
    }
    
    let sumLat = 0;
    let sumLng = 0;
    
    for (const pos of positions) {
        sumLat += pos[0];
        sumLng += pos[1];
    }
    
    return [sumLat / positions.length, sumLng / positions.length];
}

// Get cluster quality description based on silhouette score
function getClusterQualityDescription(silhouetteScore) {
    if (silhouetteScore >= 0.7) {
        return 'Excellent (strong structure)';
    } else if (silhouetteScore >= 0.5) {
        return 'Good (reasonable structure)';
    } else if (silhouetteScore >= 0.25) {
        return 'Fair (weak structure)';
    } else {
        return 'Poor (no substantial structure)';
    }
}

// Create charts for clustering visualization
function createClusteringChart(kMeansResults, clusterMetrics) {
    // Get the canvas element
    const ctx = document.getElementById('statsChart');
    
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    // Create tabs for different charts
    const chartOptions = `
        <div style="margin-bottom: 10px;">
            <label>
                <input type="radio" name="chartType" value="elbow" checked> Elbow Method
            </label>
            <label style="margin-left: 10px;">
                <input type="radio" name="chartType" value="silhouette"> Silhouette Scores
            </label>
            <label style="margin-left: 10px;">
                <input type="radio" name="chartType" value="clusters"> Cluster Sizes
            </label>
        </div>
    `;
    
    // Add options before chart
    const chartContainer = document.querySelector('.chart-container');
    const existingOptions = chartContainer.querySelector('.chart-options');
    
    if (existingOptions) {
        existingOptions.innerHTML = chartOptions;
    } else {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'chart-options';
        optionsDiv.innerHTML = chartOptions;
        chartContainer.insertBefore(optionsDiv, ctx);
    }
    
    // Create elbow method chart by default
    createElbowMethodChart(ctx, kMeansResults);
    
    // Add event listeners for chart type radio buttons
    document.querySelectorAll('input[name="chartType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'elbow') {
                createElbowMethodChart(ctx, kMeansResults);
            } else if (e.target.value === 'silhouette') {
                createSilhouetteChart(ctx, kMeansResults);
            } else {
                createClusterSizesChart(ctx, kMeansResults);
            }
        });
    });
}

// Create elbow method chart
function createElbowMethodChart(ctx, kMeansResults) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    if (!kMeansResults.inertiaValues || kMeansResults.inertiaValues.length === 0) {
        return;
    }
    
    // Normalize inertia values for better visualization
    const maxInertia = Math.max(...kMeansResults.inertiaValues);
    const normalizedInertia = kMeansResults.inertiaValues.map(val => val / maxInertia);
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: kMeansResults.kRange,
            datasets: [{
                label: 'Inertia (normalized)',
                data: normalizedInertia,
                borderColor: 'rgba(66, 133, 244, 1)',
                backgroundColor: 'rgba(66, 133, 244, 0.1)',
                tension: 0.1,
                fill: false,
                pointRadius: 4,
                pointBackgroundColor: (context) => {
                    const index = context.dataIndex;
                    return kMeansResults.kRange[index] === kMeansResults.k ? 
                        'rgba(234, 67, 53, 1)' : 'rgba(66, 133, 244, 1)';
                },
                pointBorderColor: (context) => {
                    const index = context.dataIndex;
                    return kMeansResults.kRange[index] === kMeansResults.k ? 
                        'rgba(234, 67, 53, 1)' : 'rgba(66, 133, 244, 1)';
                },
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Inertia (lower is better)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Number of Clusters (k)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Elbow Method for Optimal k'
                },
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => {
                            return `k = ${tooltipItems[0].label}`;
                        },
                        label: (context) => {
                            const k = kMeansResults.kRange[context.dataIndex];
                            const isOptimal = k === kMeansResults.k;
                            return [
                                `Inertia: ${kMeansResults.inertiaValues[context.dataIndex].toFixed(0)}`,
                                isOptimal ? '✓ Optimal cluster count' : ''
                            ].filter(Boolean);
                        }
                    }
                }
            }
        }
    });
}

// Create silhouette score chart
function createSilhouetteChart(ctx, kMeansResults) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    if (!kMeansResults.silhouetteScores || kMeansResults.silhouetteScores.length === 0) {
        return;
    }
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: kMeansResults.kRange,
            datasets: [{
                label: 'Silhouette Score',
                data: kMeansResults.silhouetteScores,
                backgroundColor: (context) => {
                    const index = context.dataIndex;
                    return kMeansResults.kRange[index] === kMeansResults.k ? 
                        'rgba(234, 67, 53, 0.6)' : 'rgba(66, 133, 244, 0.6)';
                },
                borderColor: (context) => {
                    const index = context.dataIndex;
                    return kMeansResults.kRange[index] === kMeansResults.k ? 
                        'rgba(234, 67, 53, 1)' : 'rgba(66, 133, 244, 1)';
                },
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1,
                    title: {
                        display: true,
                        text: 'Silhouette Score (higher is better)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Number of Clusters (k)'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Silhouette Scores by Cluster Count'
                },
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => {
                            return `k = ${tooltipItems[0].label}`;
                        },
                        label: (context) => {
                            const score = context.raw;
                            const k = kMeansResults.kRange[context.dataIndex];
                            const isOptimal = k === kMeansResults.k;
                            return [
                                `Silhouette Score: ${score.toFixed(3)}`,
                                `Quality: ${getClusterQualityDescription(score)}`,
                                isOptimal ? '✓ Optimal cluster count' : ''
                            ].filter(Boolean);
                        }
                    }
                }
            }
        }
    });
}

// Create cluster sizes chart
function createClusterSizesChart(ctx, kMeansResults) {
    // Destroy existing chart if it exists
    if (statsChart) {
        statsChart.destroy();
    }
    
    if (!kMeansResults.clusterSizes || kMeansResults.clusterSizes.length === 0) {
        return;
    }
    
    // Create labels for clusters
    const labels = Array.from({length: kMeansResults.k}, (_, i) => `Cluster ${i + 1}`);
    
    // Create new chart
    statsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: kMeansResults.clusterSizes,
                backgroundColor: generateClusterColors(kMeansResults.k)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Balloon Distribution by Cluster'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${value} balloons (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Visualize clusters on the map
function visualizeClusters(positions, kMeansResults) {
    if (kMeansResults.k === 0 || positions.length === 0) {
        return;
    }
    
    const { assignments, centroids, clusterSizes } = kMeansResults;
    const clusterColors = generateClusterColors(kMeansResults.k);
    
    // Draw balloons colored by cluster
    positions.forEach((pos, index) => {
        const [lat, lng, altitude] = pos;
        const clusterId = assignments[index];
        
        // Create marker for each balloon
        const marker = L.circleMarker([lat, lng], {
            radius: currentMarkerSize * 1.2,
            fillColor: clusterColors[clusterId],
            color: '#ffffff',
            weight: 1.5,
            opacity: 1,
            fillOpacity: 0.7
        }).addTo(map);
        
        // Add popup with cluster info
        marker.bindPopup(`
            <strong>Balloon at ${lat.toFixed(3)}, ${lng.toFixed(3)}</strong><br>
            Altitude: ${altitude.toFixed(2)} km<br>
            Member of Cluster #${clusterId + 1}
        `);
        
        // Add to overlays array
        statsOverlays.push(marker);
    });
    
    // Draw cluster centroids
    centroids.forEach((centroid, index) => {
        // Create marker for centroid
        const centroidMarker = L.circleMarker([centroid[0], centroid[1]], {
            radius: Math.min(15, 10 + Math.sqrt(clusterSizes[index] / 5)),
            fillColor: 'transparent',
            color: clusterColors[index],
            weight: 3,
            opacity: 1,
            dashArray: '5, 5'
        }).addTo(map);
        
        // Add popup with cluster info
        centroidMarker.bindPopup(`
            <strong>Cluster #${index + 1} Centroid</strong><br>
            Latitude: ${centroid[0].toFixed(5)}<br>
            Longitude: ${centroid[1].toFixed(5)}<br>
            Contains: ${clusterSizes[index]} balloons
        `);
        
        // Add to overlays array
        statsOverlays.push(centroidMarker);
        
        // Draw convex hull or boundary for each cluster
        const clusterPoints = positions
            .filter((_, i) => assignments[i] === index)
            .map(pos => [pos[0], pos[1]]);
            
        if (clusterPoints.length >= 3) {
            try {
                const hull = calculateConvexHull(clusterPoints);
                
                if (hull.length >= 3) {
                    const polygon = L.polygon(hull, {
                        color: clusterColors[index],
                        weight: 2,
                        opacity: 0.5,
                        fillOpacity: 0.1
                    }).addTo(map);
                    
                    statsOverlays.push(polygon);
                }
            } catch (e) {
                console.warn(`Could not create hull for cluster ${index + 1}:`, e);
            }
        }
    });
    
    // Add a legend
    clusterLegend = L.control({ position: 'bottomright' });
    
    clusterLegend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 0 5px rgba(0,0,0,0.2)';
        div.style.maxHeight = '400px'; // Maximum height for the legend
        div.style.width = '220px'; // Fixed width to accommodate cluster names
        div.style.overflowY = 'auto'; // Make it scrollable vertically
        
        div.innerHTML = '<h4 style="margin:0 0 5px 0;position:sticky;top:0;background:white;padding-bottom:5px;z-index:1;">K-Means Clusters</h4>';
        
        // Create a container for the scrollable content
        const scrollContainer = document.createElement('div');
        scrollContainer.style.maxHeight = '300px'; // Adjust as needed
        scrollContainer.style.overflowY = 'auto';
        scrollContainer.style.marginBottom = '10px';
        
        // Add cluster colors
        let legendContent = '';
        
        for (let i = 0; i < kMeansResults.k; i++) {
            const size = clusterSizes[i];
            legendContent += `
                <div style="display:flex;align-items:center;margin-bottom:3px;">
                    <div style="width:15px;height:15px;background-color:${clusterColors[i]};border-radius:50%;margin-right:5px;flex-shrink:0;"></div>
                    <span>Cluster #${i + 1} (${size} balloons)</span>
                </div>
            `;
        }
        
        scrollContainer.innerHTML = legendContent;
        div.appendChild(scrollContainer);
        
        // Add information about centroid markers
        const centroidInfo = document.createElement('div');
        centroidInfo.style.position = 'sticky';
        centroidInfo.style.bottom = '0';
        centroidInfo.style.background = 'white';
        centroidInfo.style.borderTop = '1px solid #ccc';
        centroidInfo.style.paddingTop = '5px';
        centroidInfo.style.marginTop = '5px';
        centroidInfo.style.zIndex = '1';
        
        centroidInfo.innerHTML = `
            <div style="margin-bottom:3px;">
                <strong>Legend:</strong>
            </div>
            <div style="display:flex;align-items:center;margin-bottom:3px;">
                <div style="width:15px;height:15px;border:2px dashed #666;border-radius:50%;margin-right:5px;"></div>
                <span>Cluster Centroids</span>
            </div>
            <div style="display:flex;align-items:center;margin-bottom:3px;">
                <div style="width:15px;height:15px;background-color:rgba(200,200,200,0.1);border:1px solid #666;margin-right:5px;"></div>
                <span>Cluster Boundaries</span>
            </div>
        `;
        
        div.appendChild(centroidInfo);
        
        return div;
    };
    
    clusterLegend.addTo(map);
    statsOverlays.push(clusterLegend);
}

// Calculate convex hull using Graham scan algorithm
function calculateConvexHull(points) {
    if (points.length < 3) {
        return points;
    }
    
    // Find point with lowest y-coordinate
    let lowestPoint = points[0];
    
    for (let i = 1; i < points.length; i++) {
        if (points[i][0] < lowestPoint[0] || 
            (points[i][0] === lowestPoint[0] && points[i][1] < lowestPoint[1])) {
            lowestPoint = points[i];
        }
    }
    
    // Sort points by polar angle with respect to the lowest point
    const sortedPoints = points.slice().sort((a, b) => {
        // Calculate polar angle
        const angleA = Math.atan2(a[0] - lowestPoint[0], a[1] - lowestPoint[1]);
        const angleB = Math.atan2(b[0] - lowestPoint[0], b[1] - lowestPoint[1]);
        
        // Sort by angle
        if (angleA !== angleB) {
            return angleB - angleA; // Reverse order for counterclockwise
        }
        
        // If same angle, sort by distance
        const distA = Math.pow(a[0] - lowestPoint[0], 2) + Math.pow(a[1] - lowestPoint[1], 2);
        const distB = Math.pow(b[0] - lowestPoint[0], 2) + Math.pow(b[1] - lowestPoint[1], 2);
        
        return distA - distB;
    });
    
    // Graham scan algorithm
    const hull = [sortedPoints[0], sortedPoints[1]];
    
    for (let i = 2; i < sortedPoints.length; i++) {
        while (hull.length >= 2 && !isCounterClockwise(
            hull[hull.length - 2], 
            hull[hull.length - 1], 
            sortedPoints[i]
        )) {
            hull.pop();
        }
        
        hull.push(sortedPoints[i]);
    }
    
    return hull;
}

// Check if three points form a counterclockwise turn
function isCounterClockwise(p1, p2, p3) {
    return (p2[1] - p1[1]) * (p3[0] - p2[0]) - (p2[0] - p1[0]) * (p3[1] - p2[1]) > 0;
}

// Refresh data periodically (every 5 minutes)
setInterval(fetchBalloonData, 5 * 60 * 1000); 