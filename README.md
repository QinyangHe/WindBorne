# <div align="center">🎈 WindBorne Balloon Constellation Tracker 🎈</div>

<div align="center">
<i>An interactive web application that visualizes the positions of WindBorne's global sounding balloons on a 2D map with advanced statistical analysis capabilities.</i>
</div>

---

An interactive web application that visualizes the positions of WindBorne's global sounding balloons on a 2D map with advanced statistical analysis capabilities. The application fetches data from WindBorne's API and displays the balloon positions from the past 24 hours, along with powerful analytical tools to derive operational insights.

## 🔍 Why This Project?

This project provides valuable operational insights into the global distribution and movement patterns of WindBorne's balloon constellation. By visualizing the balloon positions on an interactive map and offering sophisticated statistical analysis tools, operators can:

1. Monitor the current status of the entire balloon fleet
2. Analyze altitude distributions across the global constellation
3. Evaluate geographic coverage and identify gaps
4. Understand density patterns and clustering behaviors
5. Make data-driven operational decisions based on constellation statistics
6. Track historical positions over a 24-hour period
7. Identify regional patterns in balloon distribution

## 📊 Statistical Analysis Features

The application includes several sophisticated analytical modules:

### 📈 Altitude Analysis
- **Altitude Distribution**: Visualize the statistical distribution of balloon altitudes
- **Regional Altitude Comparison**: Compare average altitudes across different regions
- **Altitude Trends**: Track how mean and median altitudes change over time
- **Interactive Charts**: Histogram and trend visualizations for altitude data
- **Altitude Map Visualization**: Color-coded visualization of balloon altitudes

### 🌎 Geographic Coverage Analysis
- **Global Coverage Metrics**: Coverage percentage and distribution statistics
- **Coverage Gap Detection**: Identification of areas with limited balloon coverage
- **Regional Distribution Analysis**: Compare coverage across hemispheres and latitudinal bands
- **Grid-Based Coverage Visualization**: Visual representation of covered vs. uncovered areas

### 🔢 Density Analysis
- **Balloon Density Metrics**: Calculate and visualize balloon density across regions
- **Clustering Detection**: Identify natural clusters in balloon distribution
- **Isolation Metrics**: Measure the isolation of individual balloons
- **Density Heatmap**: Visual representation of balloon concentration

### 🧩 K-Means Clustering
- **Optimal Cluster Detection**: Automatically find the optimal number of clusters
- **Silhouette Analysis**: Evaluate the quality of cluster formation
- **Cluster Visualization**: Color-coded display of balloon clusters
- **Boundary Detection**: Draw convex hulls around detected clusters
- **Statistical Evaluation**: Calculate metrics like variance explained and inter-cluster distances

---

## 🛠️ Robust Data Handling Solution

The WindBorne API occasionally returns corrupted or malformed JSON data. We've implemented a sophisticated approach to handle these issues:

### ⚠️ Problem Identified
- Some API responses contain trailing '%' characters after valid JSON
- Some files have unexpected whitespace or structure issues
- Several timestamps return 404 errors (unavailable data)
- Some coordinates contain non-finite values (inf, NaN)

### 💡 Technical Solution
1. **Multi-tiered Parsing Strategy**:
   - First attempt: Standard JSON parsing with validation
   - Fallback: Regex-based extraction of coordinate triplets directly from raw text
   - Final validation: Checking coordinates are within valid ranges and finite

2. **Error Classification System**:
   - Specific error types identified (format_error, json_error, not_found, etc.)
   - Detailed error messages for debugging and user information
   - Partial data recovery when possible

### ✅ Results
- Increased data availability from 7/24 to 17/24 hours
- Improved user experience by reducing "corrupted data" messages
- Enhanced reliability with 16,000+ valid coordinates extracted
- Clear communication of data quality issues to users

This approach ensures that users get the maximum available data even when the API returns imperfect responses, providing a more complete view of the balloon constellation.

## 🖥️ User Interface Features

- **Modern, Professional Design**: Styled after WindBorne Systems' corporate aesthetic
- **Responsive Layout**: Adapts to different screen sizes and devices
- **Interactive Map Controls**:
  - Time-based exploration with an intuitive slider
  - Customizable marker size with a dedicated slider
  - Statistical visualization toggle
  - English language labels worldwide
- **Dynamic Data Visualization**:
  - Interactive charts with Chart.js
  - Color-coded map overlays
  - Comprehensive legends
  - Scrollable data displays
- **Intuitive Navigation**:
  - Tabbed interface for statistics (Numbers/Charts)
  - Clear section organization
  - Consistent visual hierarchy

## 💻 Technology Stack

- **Backend**: Python with FastAPI
- **Frontend**: HTML, CSS, JavaScript
- **Map Library**: Leaflet.js with CartoDB base maps
- **Charting**: Chart.js for statistical visualizations
- **API Client**: HTTPX (async HTTP client)
- **Data Processing**: NumPy-like algorithms implemented in pure JavaScript

## 🚀 Setup and Installation

1. Clone this repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Run the application:
   ```
   python -m uvicorn app.main:app --reload
   ```
4. Open your browser and navigate to `http://localhost:8000`

## 🔌 API Endpoints

- `/`: Main application interface
- `/api/balloons`: Returns balloon data for the past 24 hours

## 📖 Usage Guide

### 🧭 Basic Navigation
- Use the time slider to view balloon positions at different times
- Adjust the marker size slider to customize the appearance of balloons
- Click on any balloon marker to view its detailed information

### 📊 Statistical Analysis
1. Select an analysis type from the dropdown (Basic, Altitude, Coverage, Density, Clustering)
2. Check "Visualize on map" to display the analysis visually on the map
3. Switch between "Numbers" and "Chart" tabs to view different representations
4. Explore specific metrics relevant to each analysis type

### 🗺️ Map Interaction
- Pan and zoom the map to explore different regions
- View map in English regardless of geographic region
- Use the legend to interpret color-coded markers and overlays

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).