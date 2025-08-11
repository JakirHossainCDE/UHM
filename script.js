// Lahore coordinates
const LAHORE_LAT = 31.5204;
const LAHORE_LON = 74.3587;
const DEFAULT_ZOOM = 10;
const DETAIL_ZOOM = 15;

// Initialize with Lahore coordinates
function initializeMap() {
    // Set initial maps to Lahore
    document.querySelector('#map iframe').src = `https://api.mapbox.com/styles/v1/tejas2/cm9jmvniw001201sbbzidd9v1.html?title=false&access_token=pk.eyJ1IjoidGVqYXMyIiwiYSI6ImNtOWppcHJsOTBlYzQyaXNiczV5cWMyYzUifQ.iu9NmyrnMSKEeGGtnuv8Tg&zoomwheel=false#${DEFAULT_ZOOM}/${LAHORE_LAT}/${LAHORE_LON}`;
    document.querySelector('#building iframe').src = `https://api.mapbox.com/styles/v1/tejas2/cm9jr6o1z005p01sbgisn1ltz.html?title=false&access_token=pk.eyJ1IjoidGVqYXMyIiwiYSI6ImNtOWppcHJsOTBlYzQyaXNiczV5cWMyYzUifQ.iu9NmyrnMSKEeGGtnuv8Tg&zoomwheel=false#${DETAIL_ZOOM}/${LAHORE_LAT}/${LAHORE_LON}/40/85`;
}

// Map Toggle Functionality
document.querySelectorAll('.map-control-button').forEach(button => {
    button.addEventListener('click', function() {
        const mapId = this.getAttribute('data-map');
        
        if (mapId) {
            // Remove active class from all maps
            document.querySelectorAll('#map, #building').forEach(map => {
                map.classList.remove('active');
            });
            
            // Add active class to selected map
            document.getElementById(mapId).classList.add('active');
            
            // Update button states
            document.querySelectorAll('.map-control-button').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
        }
    });
});

// Simulated environmental data updates
function updateEnvironmentalData() {
    // Simulate API data with realistic variations
    const temp = (Math.random() * 5 + 24).toFixed(1);
    const rainfallProb = Math.floor(Math.random() * 30);
    const windSpeed = (Math.random() * 2 + 2.5).toFixed(1);
    
    const airQualities = ['Good', 'Moderate', 'Poor', 'Unhealthy'];
    const airQuality = airQualities[Math.floor(Math.random() * airQualities.length)];
    
    document.getElementById('temperature').innerHTML = `${temp}°C`;
    document.getElementById('rainfall').innerHTML = `${rainfallProb}%`;
    document.getElementById('airQuality').innerHTML = airQuality;
    document.getElementById('windPressure').innerHTML = `${windSpeed} m/s`;
}

// Initial update
updateEnvironmentalData();

// Update data every 30 seconds
setInterval(updateEnvironmentalData, 30000);

// Geolocation button functionality
document.getElementById('geolocation-btn').addEventListener('click', function() {
    if (navigator.geolocation) {
        const btn = this;
        const originalHTML = btn.innerHTML;
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Locating...';
        btn.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            position => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                
                // Show success message
                showLocationMessage(
                    `Location found!<br>Lat: ${position.coords.latitude.toFixed(4)}, Lon: ${position.coords.longitude.toFixed(4)}`,
                    'success'
                );
                
                // Update map to center on user's location
                updateMapCenter(position.coords.latitude, position.coords.longitude);
                
                // Simulate updating map with new location
                setTimeout(() => {
                    showLocationMessage(
                        `Loading weather data for your location...`,
                        'info'
                    );
                    
                    setTimeout(() => {
                        showLocationMessage(
                            `Local microclimate data loaded`,
                            'success'
                        );
                        
                        // Update environmental panel with new data
                        updateEnvironmentalData();
                    }, 1500);
                }, 1000);
            }, 
            error => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                
                let errorMsg = 'Unable to retrieve your location.';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'Location permission denied. Please enable in browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMsg = 'The request to get location timed out.';
                        break;
                }
                
                showLocationMessage(errorMsg, 'error');
            }
        );
    } else {
        showLocationMessage('Geolocation is not supported by your browser.', 'error');
    }
});

// Update map center based on coordinates
function updateMapCenter(latitude, longitude) {
    const activeMap = document.querySelector('#map.active, #building.active');
    if (!activeMap) return;
    
    // Update both map iframes
    const mapIframe = document.querySelector('#map iframe');
    const buildingIframe = document.querySelector('#building iframe');
    
    // Update heat map
    if (mapIframe) {
        mapIframe.src = `https://api.mapbox.com/styles/v1/tejas2/cm9jmvniw001201sbbzidd9v1.html?title=false&access_token=pk.eyJ1IjoidGVqYXMyIiwiYSI6ImNtOWppcHJsOTBlYzQyaXNiczV5cWMyYzUifQ.iu9NmyrnMSKEeGGtnuv8Tg&zoomwheel=false#${DETAIL_ZOOM}/${latitude}/${longitude}`;
    }
    
    // Update building map
    if (buildingIframe) {
        buildingIframe.src = `https://api.mapbox.com/styles/v1/tejas2/cm9jr6o1z005p01sbgisn1ltz.html?title=false&access_token=pk.eyJ1IjoidGVqYXMyIiwiYSI6ImNtOWppcHJsOTBlYzQyaXNiczV5cWMyYzUifQ.iu9NmyrnMSKEeGGtnuv8Tg&zoomwheel=false#${DETAIL_ZOOM}/${latitude}/${longitude}/40/85`;
    }
}

// Show location status message
function showLocationMessage(message, type) {
    // Remove existing message if present
    const existingMsg = document.getElementById('location-message');
    if (existingMsg) existingMsg.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.id = 'location-message';
    messageDiv.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i> ${message}`;
    messageDiv.className = `location-message ${type}`;
    
    document.querySelector('.map-wrapper').appendChild(messageDiv);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.opacity = '0';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 500);
        }
    }, 4000);
}

// Initialize the map with Lahore on page load
window.onload = initializeMap;