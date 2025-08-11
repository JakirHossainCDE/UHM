# Urban Microclimate Mapping

This project is a dynamic web application for visualizing urban microclimates, specifically focusing on urban heat islands and building footprints. It allows users to explore microclimate variations in a city and provides simulated environmental data. The application defaults to showing data for Lahore, Pakistan, but can be updated to the user's current location using geolocation.


WebMap: https://jakirhossaincde.github.io/UHM/

<img width="1363" height="678" alt="image" src="https://github.com/user-attachments/assets/bbd21023-f266-4eea-845d-2ce387895aa5" />


## Features

- **Heat Map Visualization**: Displays a color-coded map showing temperature variations across an urban area.
- **Building Footprint Map**: Switches to a detailed map view highlighting building structures and density.
- **Geolocation**: Automatically centers the map on the user's current location and updates the environmental data.
- **Environmental Data Panel**: A real-time panel that provides simulated data for temperature, rainfall, air quality, and wind speed.
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
-   **Mapbox**: The mapping platform used to render the heat map and building footprint layers.
-   **Font Awesome**: For the icons used in the UI.

## Copyright
© 2025 – Concept by **Amna Azeem** and **Md Jakir Hossain**.  
Distributed under the GNU General Public License v3.0.
