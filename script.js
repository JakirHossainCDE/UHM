const DHAKA = { lat: 23.8103, lon: 90.4125, name: 'Dhaka, Bangladesh' };
const BANGLADESH = { lat: 23.685, lon: 90.3563, name: 'Bangladesh' };
const weatherCodes = { 0:['Clear sky','fa-sun'], 1:['Mainly clear','fa-cloud-sun'], 2:['Partly cloudy','fa-cloud-sun'], 3:['Overcast','fa-cloud'], 45:['Foggy','fa-smog'], 48:['Rime fog','fa-smog'], 51:['Drizzle','fa-cloud-rain'], 53:['Drizzle','fa-cloud-rain'], 55:['Dense drizzle','fa-cloud-showers-heavy'], 61:['Light rain','fa-cloud-rain'], 63:['Rain','fa-cloud-showers-heavy'], 65:['Heavy rain','fa-cloud-showers-heavy'], 80:['Rain showers','fa-cloud-showers-heavy'], 81:['Rain showers','fa-cloud-showers-heavy'], 82:['Heavy showers','fa-cloud-showers-heavy'], 95:['Thunderstorm','fa-cloud-bolt'], 96:['Thunderstorm','fa-cloud-bolt'], 99:['Thunderstorm','fa-cloud-bolt'] };
let selected = { ...DHAKA };
let weatherData = null;
let map;
let pointMarker;
let heatLayer;
let surfaceLayer;
let surfaceData = null;
let surfaceMetric = 'temperature';
let baseLayers;
let activeBaseLayer;
let forecastRange = 'hourly';
let boundaryGeometry = null;
let boundaryLayer = null;
const BANGLADESH_BOUNDS = { south: 20.55, north: 26.65, west: 88.00, east: 92.70 };
const SURFACE_SIZE = 9;
const BANGLADESH_BOUNDARY_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries/BGD.geo.json';
const surfaceDefinitions = {
    temperature: { label: 'Temperature', unit: '°C', min: 18, max: 42, low: 'Cooler', middle: 'Warm', high: 'Hotter' },
    wind: { label: 'Wind speed', unit: ' km/h', min: 0, max: 40, low: 'Calm', middle: 'Breezy', high: 'Windy' },
    humidity: { label: 'Humidity', unit: '%', min: 20, max: 100, low: 'Drier', middle: 'Moderate', high: 'Humid' },
    rain: { label: 'Rain probability', unit: '%', min: 0, max: 100, low: 'Low chance', middle: 'Possible', high: 'Likely' },
    aqi: { label: 'Air quality', unit: ' AQI', min: 0, max: 200, low: 'Good', middle: 'Moderate', high: 'Poor' }
};

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
function surfaceCoordinates() {
    const coordinates = [];
    for (let row = 0; row < SURFACE_SIZE; row += 1) {
        for (let column = 0; column < SURFACE_SIZE; column += 1) {
            coordinates.push({
                lat: BANGLADESH_BOUNDS.south + (BANGLADESH_BOUNDS.north - BANGLADESH_BOUNDS.south) * row / (SURFACE_SIZE - 1),
                lon: BANGLADESH_BOUNDS.west + (BANGLADESH_BOUNDS.east - BANGLADESH_BOUNDS.west) * column / (SURFACE_SIZE - 1)
            });
        }
    }
    return coordinates;
}
function surfaceUrl() {
    const coordinates = surfaceCoordinates();
    const latitude = coordinates.map(point => point.lat.toFixed(4)).join(',');
    const longitude = coordinates.map(point => point.lon.toFixed(4)).join(',');
    return {
        weather: `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=Asia%2FDhaka`,
        air: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi&timezone=Asia%2FDhaka`
    };
}
function pointInRing(point, ring) {
    const [longitude, latitude] = point;
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index += 1) {
        const [currentLongitude, currentLatitude] = ring[index];
        const [previousLongitude, previousLatitude] = ring[previous];
        const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude))
            && (longitude < (previousLongitude - currentLongitude) * (latitude - currentLatitude) / (previousLatitude - currentLatitude) + currentLongitude);
        if (intersects) inside = !inside;
    }
    return inside;
}
function pointInPolygon(point, polygon) {
    return pointInRing(point, polygon[0]) && !polygon.slice(1).some(ring => pointInRing(point, ring));
}
function pointInBoundary(latitude, longitude) {
    if (!boundaryGeometry) return true;
    const polygons = boundaryGeometry.type === 'MultiPolygon' ? boundaryGeometry.coordinates : [boundaryGeometry.coordinates];
    return polygons.some(polygon => pointInPolygon([longitude, latitude], polygon));
}
async function loadBoundary() {
    try {
        const response = await fetch(BANGLADESH_BOUNDARY_URL);
        if (!response.ok) throw new Error('Bangladesh boundary unavailable');
        const boundary = await response.json();
        boundaryGeometry = boundary.geometry;
        boundaryLayer = L.geoJSON(boundary, {
            style: { color: '#073b4c', weight: 3, opacity: 1, fillColor: '#0f766e', fillOpacity: .08 },
            interactive: false
        }).addTo(map);
    } catch (error) {
        setText('dataStatus', 'Weather connected · country boundary unavailable');
    }
}
function colorForValue(value, definition) {
    const ratio = Math.max(0, Math.min(1, (value - definition.min) / (definition.max - definition.min)));
    const stops = [[58, 134, 255], [0, 168, 150], [245, 158, 11], [239, 79, 63]];
    const scaled = ratio * (stops.length - 1);
    const index = Math.min(Math.floor(scaled), stops.length - 2);
    const amount = scaled - index;
    const start = stops[index];
    const end = stops[index + 1];
    const rgb = start.map((channel, position) => Math.round(channel + (end[position] - channel) * amount));
    return `rgb(${rgb.join(',')})`;
}
function renderSurfaceLayer() {
    if (!map || !surfaceData) return;
    if (surfaceLayer) surfaceLayer.remove();
    const definition = surfaceDefinitions[surfaceMetric];
    const cells = [];
    for (let row = 0; row < SURFACE_SIZE - 1; row += 1) {
        for (let column = 0; column < SURFACE_SIZE - 1; column += 1) {
            const index = row * SURFACE_SIZE + column;
            const values = [index, index + 1, index + SURFACE_SIZE, index + SURFACE_SIZE + 1]
                .map(pointIndex => surfaceData[pointIndex]?.[surfaceMetric])
                .filter(value => Number.isFinite(value));
            if (!values.length) continue;
            const value = values.reduce((sum, item) => sum + item, 0) / values.length;
            const south = BANGLADESH_BOUNDS.south + (BANGLADESH_BOUNDS.north - BANGLADESH_BOUNDS.south) * row / (SURFACE_SIZE - 1);
            const north = BANGLADESH_BOUNDS.south + (BANGLADESH_BOUNDS.north - BANGLADESH_BOUNDS.south) * (row + 1) / (SURFACE_SIZE - 1);
            const west = BANGLADESH_BOUNDS.west + (BANGLADESH_BOUNDS.east - BANGLADESH_BOUNDS.west) * column / (SURFACE_SIZE - 1);
            const east = BANGLADESH_BOUNDS.west + (BANGLADESH_BOUNDS.east - BANGLADESH_BOUNDS.west) * (column + 1) / (SURFACE_SIZE - 1);
            if (!pointInBoundary((south + north) / 2, (west + east) / 2)) continue;
            cells.push(L.rectangle([[south, west], [north, east]], {
                color: colorForValue(value, definition),
                weight: 0,
                fillColor: colorForValue(value, definition),
                fillOpacity: .34
            }).bindTooltip(`${definition.label}: ${value.toFixed(1)}${definition.unit}`, { sticky: true, className: 'heat-tooltip' }));
        }
    }
    surfaceLayer = L.layerGroup(cells).addTo(map);
    if (boundaryLayer) boundaryLayer.bringToFront();
}
async function loadSurfaceData() {
    try {
        const urls = surfaceUrl();
        const [weatherResponse, airResponse] = await Promise.all([fetch(urls.weather), fetch(urls.air)]);
        if (!weatherResponse.ok || !airResponse.ok) throw new Error('Surface data unavailable');
        const weather = await weatherResponse.json();
        const air = await airResponse.json();
        const weatherPoints = Array.isArray(weather) ? weather : [weather];
        const airPoints = Array.isArray(air) ? air : [air];
        surfaceData = weatherPoints.map((point, index) => {
            const current = point.current || {};
            const hourIndex = Math.max((point.hourly?.time || []).findIndex(time => time >= current.time), 0);
            return {
                temperature: Number(current.temperature_2m),
                wind: Number(current.wind_speed_10m),
                humidity: Number(current.relative_humidity_2m),
                rain: Number(point.hourly?.precipitation_probability?.[hourIndex] || 0),
                aqi: Number(airPoints[index]?.current?.us_aqi)
            };
        });
        renderSurfaceLayer();
    } catch (error) {
        setText('dataStatus', 'Point weather connected · map layer unavailable');
    }
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
    heatLayer = L.layerGroup().addTo(map);
}
async function initializeMap() {
    map = L.map('map', { zoomControl: false, attributionControl: true, maxBounds: [[20.2, 87.6], [27.1, 93.1]], maxBoundsViscosity: .7 }).setView([BANGLADESH.lat, BANGLADESH.lon], 7);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    baseLayers = {
        urban: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }),
        satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community' })
    };
    activeBaseLayer = baseLayers.urban.addTo(map);
    buildHeatLayer();
    await loadBoundary();
    loadSurfaceData();
    window.setInterval(loadSurfaceData, 60 * 60 * 1000);
    setSelectedPoint(BANGLADESH.lat, BANGLADESH.lon, BANGLADESH.name);
    map.on('click', event => setSelectedPoint(event.latlng.lat, event.latlng.lng, `Point ${event.latlng.lat.toFixed(3)}°, ${event.latlng.lng.toFixed(3)}°`));
}
document.querySelectorAll('.forecast-tab').forEach(button => button.addEventListener('click', () => { forecastRange = button.dataset.range; document.querySelectorAll('.forecast-tab').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-selected', item === button ? 'true' : 'false'); }); renderForecast(); }));
document.getElementById('surfaceLayer').addEventListener('change', event => { surfaceMetric = event.target.value; renderSurfaceLayer(); });
document.getElementById('refreshWeather').addEventListener('click', loadWeather);
document.getElementById('heatLayerBtn').addEventListener('click', () => {
    if (!surfaceLayer) return;
    if (map.hasLayer(surfaceLayer)) {
        map.removeLayer(surfaceLayer);
        document.getElementById('heatLayerBtn').classList.remove('active');
    } else {
        surfaceLayer.addTo(map);
        document.getElementById('heatLayerBtn').classList.add('active');
    }
});
function switchBaseLayer(name) {
    if (activeBaseLayer === baseLayers[name]) return;
    map.removeLayer(activeBaseLayer);
    activeBaseLayer = baseLayers[name].addTo(map);
    document.getElementById('urbanMapBtn').classList.toggle('active', name === 'urban');
    document.getElementById('satelliteMapBtn').classList.toggle('active', name === 'satellite');
}
document.getElementById('urbanMapBtn').addEventListener('click', () => switchBaseLayer('urban'));
document.getElementById('satelliteMapBtn').addEventListener('click', () => switchBaseLayer('satellite'));
document.getElementById('atlasBtn').addEventListener('click', () => { document.getElementById('atlasModal').classList.add('open'); document.getElementById('atlasModal').setAttribute('aria-hidden', 'false'); });
document.getElementById('closeAtlas').addEventListener('click', () => { document.getElementById('atlasModal').classList.remove('open'); document.getElementById('atlasModal').setAttribute('aria-hidden', 'true'); });
document.getElementById('atlasModal').addEventListener('click', event => { if (event.target.id === 'atlasModal') document.getElementById('closeAtlas').click(); });
document.getElementById('geolocation-btn').addEventListener('click', () => {
    if (!navigator.geolocation) { setText('dataStatus', 'Geolocation unavailable'); return; }
    navigator.geolocation.getCurrentPosition(({ coords }) => { map.setView([coords.latitude, coords.longitude], 13); setSelectedPoint(coords.latitude, coords.longitude, 'Your location'); }, () => setText('dataStatus', 'Location permission denied'), { enableHighAccuracy: true, timeout: 10000 });
});
initializeMap();
