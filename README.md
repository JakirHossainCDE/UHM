# Urban Heat Mapping

This project is a dynamic web application for visualizing environmental conditions and urban microclimates across Bangladesh using live Open-Meteo weather and air-quality data. The application opens on a Bangladesh-wide map and can be updated to the user's current location using geolocation.


WebMap: https://jakirhossaincde.github.io/UHM/

## Features

- **Live Bangladesh Surface**: Displays a Bangladesh-wide interpolated grid surface. The layer selector supports temperature, wind speed, humidity, rain probability, and air quality.
- **Three-Step Map Legend**: Uses cooler/moderate/hotter-style color steps for the active surface variable, with variable-specific labels such as calm/breezy/windy or good/moderate/poor.
- **Urban Live Surface**: Combines the original CARTO Voyager urban basemap with the live environmental surface. The live surface covers Bangladesh and an approximately 250 km surrounding analysis zone.
- **No-Key Urban Basemap**: Uses CARTO Voyager tiles without a Mapbox token or other application key.
- **Satellite Imagery**: Provides an optional Esri World Imagery layer through the `Satellite imagery` button for visualizing land cover and built-up form.
- **Exact Bangladesh Boundary**: Shows the high-resolution geoBoundaries ADM0 country outline over the buffered environmental surface.
- **3D Building Atlas**: Opens the official GlobalBuildingAtlas viewer for building height and urban-form context across Bangladesh.
- **Point Weather Inspection**: Click any point in Bangladesh to retrieve its current weather and forecast.
- **Forecast Modes**: Provides the next 12 hours and a seven-day forecast.
- **Geolocation**: Automatically centers the map on the user's current location and updates the environmental data.
- **Environmental Data Panel**: A real-time panel that provides live data for temperature, rainfall, air quality, humidity, and wind speed.
- **Responsive Design**: The interface is designed to be fully functional and aesthetically pleasing on both desktop and mobile devices.

## Project Structure

The project is organized into five main files:
- `index.html`: The main HTML file that provides the structure of the web page.
- `style.css`: Contains all the CSS rules for styling the application.
- `script.js`: Manages all interactive functionality, including map toggling, geolocation, and data simulation.
- `app.py`: A placeholder Python file. 
- `README.md`: This file, which provides a comprehensive overview of the project.

## How to Run

Since this is a static web application, you can simply open the `index.html` file in any modern web browser to view the project.

If you want to serve it using a local web server (useful for more complex projects or testing), you can use the provided `app.py` with Flask:

1.  **Install Flask**:
    ```bash
    pip install Flask
    ```
2.  **Run the application**:
    ```bash
    python app.py
    ```
    The application will be available at `http://127.0.0.1:5000`.

## Technologies Used

-   **HTML5**: For the web page structure.
-   **CSS3**: For all the styling, including the gradient background and responsive design.
-   **JavaScript (ES6+)**: For dynamic functionality and user interactions.
-   **Leaflet**: The interactive map engine and layer switching framework.
-   **CARTO Voyager**: The default no-key urban basemap.
-   **Esri World Imagery**: Selectable satellite imagery basemap; attribution is shown on the map.
-   **geoBoundaries ADM0 GeoJSON**: High-resolution Bangladesh country outline and surface mask.
-   **Open-Meteo**: Live weather, forecast, and air-quality data.
-   **Font Awesome**: For the icons used in the UI.

## Copyright
© 2025 – Concept by **Amna Azeem** and **Md Jakir Hossain**.  
Distributed under the GNU General Public License v3.0.
