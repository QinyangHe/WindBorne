# WindBorne Balloon Constellation Tracker

An interactive web application that visualizes the positions of WindBorne's global sounding balloons on a 2D map. The application fetches data from WindBorne's API and displays the balloon positions from the past 24 hours.

## Why This Project?

This project was chosen because it provides valuable operational insights into the global distribution and movement patterns of WindBorne's balloon constellation. By visualizing the balloon positions on an interactive map and tracking their movements over time, operators can:

1. Monitor the current status of the entire balloon fleet
2. Track historical paths of individual balloons
3. Identify patterns in balloon movement and positioning
4. Quickly spot anomalies or issues with specific balloons
5. Understand global coverage at a glance

The ability to see the constellation's evolution over a 24-hour period is particularly valuable for operational decision-making and planning.

## Robust Data Handling Solution

The WindBorne API occasionally returns corrupted or malformed JSON data. We've implemented a sophisticated approach to handle these issues:

### Problem Identified
- Some API responses contain trailing '%' characters after valid JSON
- Some files have unexpected whitespace or structure issues
- Several timestamps return 404 errors (unavailable data)
- Some coordinates contain non-finite values (inf, NaN)

### Technical Solution
1. **Multi-tiered Parsing Strategy**:
   - First attempt: Standard JSON parsing with validation
   - Fallback: Regex-based extraction of coordinate triplets directly from raw text
   - Final validation: Checking coordinates are within valid ranges and finite

2. **Error Classification System**:
   - Specific error types identified (format_error, json_error, not_found, etc.)
   - Detailed error messages for debugging and user information
   - Partial data recovery when possible

3. **Results**:
   - Increased data availability from 7/24 to 17/24 hours
   - Improved user experience by reducing "corrupted data" messages
   - Enhanced reliability with 16,000+ valid coordinates extracted
   - Clear communication of data quality issues to users

This approach ensures that users get the maximum available data even when the API returns imperfect responses, providing a more complete view of the balloon constellation.

## Features

- Interactive 2D map using Leaflet
- Displays balloon positions from the past 24 hours
- Allows time-based exploration with a slider control
- Animation feature to visualize balloon movement over time
- Path tracing to show the trajectory of individual balloons
- Robust handling of corrupted API data
- Auto-refreshing data every 5 minutes
- Responsive design for both desktop and mobile views

## Technology Stack

- Backend: Python with FastAPI
- Frontend: HTML, CSS, JavaScript
- Map Library: Leaflet.js
- API Client: HTTPX (async HTTP client)

## Setup and Installation

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

## API Endpoints

- `/`: Main application interface
- `/api/balloons`: Returns balloon data for the past 24 hours

## Usage

- Use the time slider to view balloon positions at different times
- Click the "Play Animation" button to see how balloons move over time
- Click on a balloon marker to see detailed information and its path over time
- The sidebar displays information about the number of balloons and any corrupted data points

## Deployment

To deploy this application to a public URL, you can use services like:

- Heroku
- Vercel
- Render
- Railway
- Google Cloud Run
- AWS Elastic Beanstalk

Follow the deployment instructions for your chosen platform, making sure to set the appropriate environment variables if needed.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).