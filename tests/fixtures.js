// Synthetic fixtures for automated tests only. Never imported by the website.
export const NOW = Date.parse('2026-10-14T12:30:00Z');
export const HOUR = Math.floor(NOW / 3600000) * 3600;

export function weatherFixture({ temp = 28, lat = 23.8, lon = 90.4, timezone = 'Asia/Dhaka' } = {}) {
  const hours = Array.from({ length: 168 }, (_, i) => HOUR - 12 * 3600 + i * 3600);
  return {
    latitude: lat, longitude: lon, timezone, utc_offset_seconds: timezone === 'Asia/Dhaka' ? 21600 : 7200, elevation: 15,
    current: { time: HOUR + 1800, temperature_2m: temp, relative_humidity_2m: 70, apparent_temperature: temp === null ? null : temp + 2, is_day: 1, weather_code: 2, wind_speed_10m: 12.5, wind_direction_10m: 45, precipitation: 0 },
    hourly: { time: hours, temperature_2m: hours.map((_, i) => 20 + i % 10), precipitation_probability: hours.map((_, i) => i % 5 * 10), relative_humidity_2m: hours.map(() => 70), wind_speed_10m: hours.map(() => 12), weather_code: hours.map(() => 2) },
    daily: { time: Array.from({ length: 7 }, (_, i) => Date.parse('2026-10-13T18:00:00Z') / 1000 + i * 86400), temperature_2m_max: [30, 32, 29, 28, 29, 30, 31], temperature_2m_min: [21, 23, 23, 22, 21, 21, 23], weather_code: [0, 2, 3, 61, 80, 2, 0], precipitation_probability_max: [0, 10, 20, 60, 80, 20, 0] },
  };
}

export const airFixture = (aqi = 72) => ({ current: { time: HOUR, us_aqi: aqi, pm2_5: 12.4 } });
export const jsonResponse = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

export function fixtureFetch(url) {
  const request = new URL(url);
  if (request.hostname.includes('geocoding')) return Promise.resolve(jsonResponse({ results: [{ name: 'Rome', country: 'Italy', admin1: 'Lazio', latitude: 41.8919, longitude: 12.5113 }] }));
  const lats = (request.searchParams.get('latitude') || '23.8').split(',').map(Number);
  const lons = (request.searchParams.get('longitude') || '90.4').split(',').map(Number);
  const values = lats.map((lat, i) => request.hostname.startsWith('air-quality')
    ? airFixture() : weatherFixture({ lat, lon: lons[i], temp: lat > 40 ? 18 : 28, timezone: lat > 40 ? 'Europe/Rome' : 'Asia/Dhaka' }));
  return Promise.resolve(jsonResponse(values.length > 1 ? values : values[0]));
}
