const DHAKA_LAT = 23.8103;
const DHAKA_LON = 90.4125;
const MAPBOX_TOKEN = 'pk.eyJ1IjoidGVqYXMyIiwiYSI6ImNtOWppcHJsOTBlYzQyaXNiczV5cWMyYzUifQ.iu9NmyrnMSKEeGGtnuv8Tg';
const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${DHAKA_LAT}&longitude=${DHAKA_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code&forecast_days=1&timezone=Asia%2FDhaka`;
const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${DHAKA_LAT}&longitude=${DHAKA_LON}&current=us_aqi,pm2_5&timezone=Asia%2FDhaka`;
const weatherCodes = {0:['Clear sky','fa-sun'],1:['Mainly clear','fa-cloud-sun'],2:['Partly cloudy','fa-cloud-sun'],3:['Overcast','fa-cloud'],45:['Foggy','fa-smog'],48:['Rime fog','fa-smog'],51:['Light drizzle','fa-cloud-rain'],53:['Drizzle','fa-cloud-rain'],55:['Dense drizzle','fa-cloud-showers-heavy'],61:['Light rain','fa-cloud-rain'],63:['Rain','fa-cloud-showers-heavy'],65:['Heavy rain','fa-cloud-showers-heavy'],80:['Rain showers','fa-cloud-showers-heavy'],81:['Rain showers','fa-cloud-showers-heavy'],82:['Heavy showers','fa-cloud-showers-heavy'],95:['Thunderstorm','fa-cloud-bolt'],96:['Thunderstorm','fa-cloud-bolt'],99:['Thunderstorm','fa-cloud-bolt']};
function mapUrl(zoom, latitude, longitude) { return `https://api.mapbox.com/styles/v1/tejas2/cm9jmvniw001201sbbzidd9v1.html?title=false&access_token=${MAPBOX_TOKEN}&zoomwheel=false#${zoom}/${latitude}/${longitude}`; }
function initializeMap(latitude = DHAKA_LAT, longitude = DHAKA_LON) { const frame = document.querySelector('#map iframe'); if (frame) frame.src = mapUrl(10, latitude, longitude); }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function getWeatherDescription(code) { return weatherCodes[code] || ['Variable conditions','fa-cloud-sun']; }
function formatHour(isoTime) { return new Date(isoTime).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', timeZone:'Asia/Dhaka'}); }
function renderForecast(hourly) { const list=document.getElementById('forecastList'); const currentHour=new Date().getHours(); const start=hourly.time.findIndex(time=>new Date(time).getHours()===currentHour); const first=start>=0?start:0; list.innerHTML=hourly.time.slice(first,first+5).map((time,index)=>{const [label,icon]=getWeatherDescription(hourly.weather_code[first+index]); return `<div class="forecast-item ${index===0?'current':''}"><span>${index===0?'Now':formatHour(time)}</span><i class="fas ${icon}" title="${label}"></i><strong>${Math.round(hourly.temperature_2m[first+index])}°</strong><small>${hourly.precipitation_probability[first+index]}% rain</small></div>`;}).join(''); }
function airQualityLabel(aqi) { if (aqi == null) return '--'; if (aqi <= 50) return 'Good'; if (aqi <= 100) return 'Moderate'; if (aqi <= 150) return 'Unhealthy'; return 'Poor'; }
async function updateWeather() { setText('dataStatus','Updating live weather'); try { const [weatherResponse,airResponse]=await Promise.all([fetch(weatherUrl),fetch(airQualityUrl)]); if(!weatherResponse.ok||!airResponse.ok) throw new Error('Weather service unavailable'); const weather=await weatherResponse.json(); const air=await airResponse.json(); const current=weather.current; const [summary,icon]=getWeatherDescription(current.weather_code); document.getElementById('weatherIcon').className=`fas ${icon} weather-icon`; setText('weatherSummary',summary); setText('temperature',`${Math.round(current.temperature_2m)}°`); setText('feelsLike',`${current.apparent_temperature.toFixed(1)}°C`); setText('humidity',`${current.relative_humidity_2m}%`); setText('wind',`${current.wind_speed_10m.toFixed(1)} km/h`); const chanceIndex=weather.hourly.time.findIndex(time=>time>=current.time); setText('rainfall',`${weather.hourly.precipitation_probability[chanceIndex<0?0:chanceIndex] ?? 0}%`); setText('airQuality',airQualityLabel(air.current?.us_aqi)); setText('updatedAt',`Updated ${formatHour(current.time)}`); setText('dataStatus','Live data connected'); renderForecast(weather.hourly); } catch(error) { setText('dataStatus','Weather data unavailable'); showLocationMessage('Live weather is temporarily unavailable. Please try refresh again.','error'); } }
function showLocationMessage(message,type='info') { const existing=document.getElementById('location-message'); if(existing) existing.remove(); const element=document.createElement('div'); element.id='location-message'; element.className=`location-message ${type}`; element.textContent=message; document.querySelector('.map-wrapper').appendChild(element); setTimeout(()=>element.remove(),4500); }
document.querySelectorAll('.map-control-button[data-map]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.map-layer').forEach(layer=>layer.classList.remove('active')); document.getElementById(button.dataset.map).classList.add('active'); document.querySelectorAll('.map-control-button[data-map]').forEach(item=>item.classList.remove('active')); button.classList.add('active');}));
document.getElementById('refreshWeather').addEventListener('click',updateWeather);
document.getElementById('geolocation-btn').addEventListener('click',()=>{if(!navigator.geolocation){showLocationMessage('Geolocation is not supported by this browser.','error');return;} const button=document.getElementById('geolocation-btn'); button.disabled=true; navigator.geolocation.getCurrentPosition(({coords})=>{initializeMap(coords.latitude,coords.longitude);button.disabled=false;showLocationMessage('Map centered on your location.','success');},()=>{button.disabled=false;showLocationMessage('Location permission was not available.','error');},{enableHighAccuracy:true,timeout:10000});});
initializeMap();
updateWeather();// Dhaka coordinates
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
