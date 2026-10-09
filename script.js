const DHAKA = { lat: 23.8103, lon: 90.4125, name: 'Dhaka, Bangladesh' };
const weatherCodes = { 0:['Clear sky','fa-sun'], 1:['Mainly clear','fa-cloud-sun'], 2:['Partly cloudy','fa-cloud-sun'], 3:['Overcast','fa-cloud'], 45:['Foggy','fa-smog'], 48:['Rime fog','fa-smog'], 51:['Drizzle','fa-cloud-rain'], 53:['Drizzle','fa-cloud-rain'], 55:['Dense drizzle','fa-cloud-showers-heavy'], 61:['Light rain','fa-cloud-rain'], 63:['Rain','fa-cloud-showers-heavy'], 65:['Heavy rain','fa-cloud-showers-heavy'], 80:['Rain showers','fa-cloud-showers-heavy'], 81:['Rain showers','fa-cloud-showers-heavy'], 82:['Heavy showers','fa-cloud-showers-heavy'], 95:['Thunderstorm','fa-cloud-bolt'], 96:['Thunderstorm','fa-cloud-bolt'], 99:['Thunderstorm','fa-cloud-bolt'] };
let selected = { ...DHAKA };
let weatherData = null;
let map;
let pointMarker;
let heatLayer;
let baseLayers;
let activeBaseLayer;
let forecastRange = 'hourly';

function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function description(code) { return weatherCodes[code] || ['Variable conditions', 'fa-cloud-sun']; }
function formatHour(value) { return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' }); }
function formatDay(value) { return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
function airQualityLabel(aqi) { if (aqi == null) return '--'; if (aqi <= 50) return 'Good'; if (aqi <= 100) return 'Moderate'; if (aqi <= 150) return 'Unhealthy'; return 'Poor'; }
function apiUrl(lat, lon) {
    const weather = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=7&timezone=Asia%2FDhaka`;
    const air = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5&timezone=Asia%2FDhaka`;
    return { weather, air };
}
function renderHourly(hourly) {
    const now = hourly.time.findIndex(time => time >= weatherData.current.current.time);
    const first = Math.max(now, 0);
    document.getElementById('forecastList').innerHTML = hourly.time.slice(first, first + 12).map((time, index) => {
        const [, icon] = description(hourly.weather_code[first + index]);
        return `<div class="forecast-item ${index === 0 ? 'current' : ''}"><span>${index === 0 ? 'Now' : formatHour(time)}</span><i class="fas ${icon}"></i><strong>${Math.round(hourly.temperature_2m[first + index])}°</strong><small>${hourly.precipitation_probability[first + index] || 0}% rain</small></div>`;
    }).join('');
}
function renderDaily(daily) {
    document.getElementById('forecastList').innerHTML = daily.time.map((day, index) => {
        const [label, icon] = description(daily.weather_code[index]);
        return `<div class="daily-item"><strong>${index === 0 ? 'Today' : formatDay(day)}</strong><i class="fas ${icon}" title="${label}"></i><b>${Math.round(daily.temperature_2m_max[index])}° / ${Math.round(daily.temperature_2m_min[index])}°</b><small>${daily.precipitation_probability_max[index] || 0}% rain</small></div>`;
    }).join('');
}
function renderForecast() { if (!weatherData) return; if (forecastRange === 'hourly') renderHourly(weatherData.current.hourly); else renderDaily(weatherData.current.daily); }
function mapIcon() { return L.divIcon({ className: 'selected-point', html: '', iconSize: [18, 18] }); }
function setSelectedPoint(lat, lon, label = 'Selected map point') {
    selected = { lat, lon, name: label };
    if (pointMarker) pointMarker.setLatLng([lat, lon]); else pointMarker = L.marker([lat, lon], { icon: mapIcon() }).addTo(map);
    setText('selectedLocation', label);
    loadWeather();
}
async function loadWeather() {
    setText('dataStatus', 'Loading live data');
    const urls = apiUrl(selected.lat.toFixed(4), selected.lon.toFixed(4));
    try {
        const [weatherResult, airResult] = await Promise.allSettled([fetch(urls.weather), fetch(urls.air)]);
        if (weatherResult.status !== 'fulfilled' || !weatherResult.value.ok) throw new Error('Weather service unavailable');
        const weatherResponse = weatherResult.value;
        const airResponse = airResult.status === 'fulfilled' ? airResult.value : null;
        const weather = await weatherResponse.json();
        const air = airResponse && airResponse.ok ? await airResponse.json() : { current: {} };
        weatherData = { current: weather, air };
        const current = weatherData.current.current;
        const [summary, icon] = description(current.weather_code);
        document.getElementById('weatherIcon').className = `fas ${icon} weather-icon`;
        setText('weatherSummary', summary);
        setText('temperature', `${Math.round(current.temperature_2m)}°`);
        setText('feelsLike', `${current.apparent_temperature.toFixed(1)}°C`);
        setText('humidity', `${current.relative_humidity_2m}%`);
        setText('wind', `${current.wind_speed_10m.toFixed(1)} km/h`);
        const rainIndex = Math.max(weatherData.current.hourly.time.findIndex(time => time >= current.time), 0);
        setText('rainfall', `${weatherData.current.hourly.precipitation_probability[rainIndex] || 0}%`);
        setText('airQuality', airQualityLabel(weatherData.air.current.us_aqi));
        setText('updatedAt', `Updated ${formatHour(current.time)}`);
        setText('dataStatus', airResponse && airResponse.ok ? 'Live data connected' : 'Weather connected · AQI unavailable');
        renderForecast();
    } catch (error) {
        setText('dataStatus', 'Weather data unavailable');
        setText('updatedAt', 'Try refreshing the data');
    }
}
function buildHeatLayer() {
    const points = [
        [23.8103, 90.4125, 1.0, 'Central Dhaka · very high'],
        [23.7806, 90.4071, .88, 'Dhanmondi · high'],
        [23.7465, 90.376, .72, 'Lalbagh · moderate'],
        [23.8379, 90.3617, .74, 'Mirpur · moderate'],
        [23.8759, 90.3795, .6, 'Uttara · lower'],
        [23.7621, 90.431, .82, 'Jatrabari · high'],
        [23.7239, 90.395, .68, 'Keraniganj · moderate'],
        [23.851, 90.401, .9, 'Gulshan · very high']
    ];
    heatLayer = L.layerGroup(points.map(([lat, lon, intensity, label]) => {
        const color = intensity > .82 ? '#ef4f3f' : intensity > .68 ? '#f59e0b' : '#3a86ff';
        return L.circle([lat, lon], {
            radius: 900 + intensity * 650,
            color,
            weight: 1,
            opacity: .55,
            fillColor: color,
            fillOpacity: .16 + intensity * .13
        }).bindTooltip(label, { direction: 'top', className: 'heat-tooltip' });
    }));
    heatLayer.addTo(map);
}
function initializeMap() {
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([DHAKA.lat, DHAKA.lon], 11);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    baseLayers = {
        urban: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20, subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }),
        previous: L.tileLayer('https://api.mapbox.com/styles/v1/tejas2/cm9jmvniw001201sbbzidd9v1/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoidGVqYXMyIiwiYSI6ImNtOWppcHJsOTBlYzQyaXNiczV5cWMyYzUifQ.iu9NmyrnMSKEeGGtnuv8Tg', { maxZoom: 20, attribution: '&copy; Mapbox &copy; OpenStreetMap' })
    };
    activeBaseLayer = baseLayers.urban.addTo(map);
    buildHeatLayer();
    setSelectedPoint(DHAKA.lat, DHAKA.lon, DHAKA.name);
    map.on('click', event => setSelectedPoint(event.latlng.lat, event.latlng.lng, `Point ${event.latlng.lat.toFixed(3)}°, ${event.latlng.lng.toFixed(3)}°`));
}
document.querySelectorAll('.forecast-tab').forEach(button => button.addEventListener('click', () => { forecastRange = button.dataset.range; document.querySelectorAll('.forecast-tab').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-selected', item === button ? 'true' : 'false'); }); renderForecast(); }));
document.getElementById('refreshWeather').addEventListener('click', loadWeather);
document.getElementById('heatLayerBtn').addEventListener('click', () => { if (map.hasLayer(heatLayer)) { map.removeLayer(heatLayer); document.getElementById('heatLayerBtn').classList.remove('active'); } else { heatLayer.addTo(map); document.getElementById('heatLayerBtn').classList.add('active'); } });
function switchBaseLayer(name) {
    if (activeBaseLayer === baseLayers[name]) return;
    map.removeLayer(activeBaseLayer);
    activeBaseLayer = baseLayers[name].addTo(map);
    document.getElementById('urbanMapBtn').classList.toggle('active', name === 'urban');
    document.getElementById('previousMapBtn').classList.toggle('active', name === 'previous');
}
document.getElementById('urbanMapBtn').addEventListener('click', () => switchBaseLayer('urban'));
document.getElementById('previousMapBtn').addEventListener('click', () => switchBaseLayer('previous'));
document.getElementById('atlasBtn').addEventListener('click', () => { document.getElementById('atlasModal').classList.add('open'); document.getElementById('atlasModal').setAttribute('aria-hidden', 'false'); });
document.getElementById('closeAtlas').addEventListener('click', () => { document.getElementById('atlasModal').classList.remove('open'); document.getElementById('atlasModal').setAttribute('aria-hidden', 'true'); });
document.getElementById('atlasModal').addEventListener('click', event => { if (event.target.id === 'atlasModal') document.getElementById('closeAtlas').click(); });
document.getElementById('geolocation-btn').addEventListener('click', () => {
    if (!navigator.geolocation) { setText('dataStatus', 'Geolocation unavailable'); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => { map.setView([coords.latitude, coords.longitude], 13); setSelectedPoint(coords.latitude, coords.longitude, 'Your location'); }, () => setText('dataStatus', 'Location permission denied'), { enableHighAccuracy: true, timeout: 10000 });
});
initializeMap();
