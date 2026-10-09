// Dhaka coordinates
const DHAKA_LAT = 23.8103;
const DHAKA_LON = 90.4125;
const DEFAULT_ZOOM = 10;
const DETAIL_ZOOM = 15;




// Initialize with Dhaka coordinates
function initializeMap() {
    // Set initial maps to Dhaka
    document.querySelector('#map iframe').src = `https://api.mapbox.com/styles/v1/tejas2/cm9jmvniw001201sbbzidd9v1.html?title=false&access_token=pk.eyJ1IjoidGVqYXMyIiwiYSI6ImNtOWppcHJsOTBlYzQyaXNiczV5cWMyYzUifQ.iu9NmyrnMSKEeGGtnuv8Tg&zoomwheel=false#${DEFAULT_ZOOM}/${DHAKA_LAT}/${DHAKA_LON}`;
    document.querySelector('#building iframe').src = `https://api.mapbox.com/styles/v1/tejas2/cm9jr6o1z005p01sbgisn1ltz.html?title=false&access_token=pk.eyJ1IjoidGVqYXMyIiwiYSI6ImNtOWppcHJsOTBlYzQyaXNiczV5cWMyYzUifQ.iu9NmyrnMSKEeGGtnuv8Tg&zoomwheel=false#${DETAIL_ZOOM}/${DHAKA_LAT}/${DHAKA_LON}/40/85`;
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
