/** Fine display raster over a bounded, regular set of model samples.
 * Interpolation changes presentation, not the native meteorological resolution.
 */
import { clamp, isNumber, normalizeLongitude, METRICS, metricColor } from './core.js?v=2.3.0';

export const SAMPLE_SIDE = 9;
export const MAX_SAMPLES = SAMPLE_SIDE * SAMPLE_SIDE;
export const AUTO_LAYER_INTERVAL = 20000;

export function surfaceSampleGrid({ south, north, west, east }, size = SAMPLE_SIDE) {
  if (![south, north, west, east].every(isNumber) || !Number.isInteger(size) || size < 2 || size > SAMPLE_SIDE) throw new Error('Invalid surface sampling bounds');
  south = clamp(south, -85, 85); north = clamp(north, -85, 85);
  if (north <= south) throw new Error('Invalid surface latitude bounds');
  if (east < west) east += Math.ceil((west - east) / 360) * 360;
  if (east <= west) throw new Error('Invalid surface longitude bounds');
  const span = Math.min(east - west, 360), centre = (east + west) / 2;
  west = centre - span / 2; east = centre + span / 2;
  return Array.from({ length: size * size }, (_, i) => {
    const row = Math.floor(i / size), col = i % size;
    const lat = south + row / (size - 1) * (north - south), displayLon = west + col / (size - 1) * span;
    return { lat: Number(lat.toFixed(5)), lon: Number(normalizeLongitude(displayLon).toFixed(5)),
      displayLon, row, col, name: 'Model sample', country: '',
      frame: { south, north, west, east, size } };
  });
}

export function createField(points) {
  const frame = points?.[0]?.frame;
  if (!frame || !Number.isInteger(frame.size) || frame.size < 2 || frame.size > SAMPLE_SIDE || points.length !== frame.size ** 2) return null;
  if (![frame.south, frame.north, frame.west, frame.east].every(isNumber)) return null;
  if (!(frame.north > frame.south && frame.east > frame.west)) return null;
  if (points.some((point, i) => point.row !== Math.floor(i / frame.size) || point.col !== i % frame.size)) return null;
  return { ...frame, points };
}

/** Bilinear sampling with no extrapolation and no filling through missing nodes.
 * Wind arrows remain actual sample vectors; only the speed field is interpolated.
 */
export function interpolateField(field, lat, lon, metric) {
  if (!field || !isNumber(lat) || !isNumber(lon) || !Object.hasOwn(METRICS, metric)) return null;
  const { south, north, west, east, size, points } = field;
  const xlon = lon + Math.round(((east + west) / 2 - lon) / 360) * 360;
  if (lat < south - 1e-8 || lat > north + 1e-8 || xlon < west - 1e-8 || xlon > east + 1e-8) return null;
  const x = clamp((xlon - west) / (east - west) * (size - 1), 0, size - 1);
  const y = clamp((lat - south) / (north - south) * (size - 1), 0, size - 1);
  const col = Math.min(Math.floor(x), size - 2), row = Math.min(Math.floor(y), size - 2);
  const dx = x - col, dy = y - row;
  const corners = [[row * size + col, (1 - dx) * (1 - dy)], [row * size + col + 1, dx * (1 - dy)],
    [(row + 1) * size + col, (1 - dx) * dy], [(row + 1) * size + col + 1, dx * dy]];
  let value = 0, time;
  for (const [index, weight] of corners) {
    if (weight < 1e-10) continue;
    const point = points[index], sample = point.values?.[metric];
    const stamp = metric === 'aqi' ? point.airTime : metric === 'rain' ? point.rainTime : point.time;
    if (!isNumber(sample) || !isNumber(stamp) || (time !== undefined && time !== stamp)) return null;
    time = stamp;
    value += sample * weight;
  }
  return value;
}

const palettes = new Map();
function paletteFor(metric) {
  if (palettes.has(metric)) return palettes.get(metric);
  const spec = METRICS[metric], result = [], steps = metric === 'aqi' ? 501 : 1024;
  for (let i = 0; i < steps; i++) {
    const color = metricColor(spec.min + i / (steps - 1) * (spec.max - spec.min), metric);
    result.push(color.startsWith('#') ? [1, 3, 5].map(n => parseInt(color.slice(n, n + 2), 16)) : color.match(/[\d.]+/g).map(Number));
  }
  palettes.set(metric, result); return result;
}
const mercator = lat => Math.log(Math.tan(Math.PI / 4 + clamp(lat, -85.05112878, 85.05112878) * Math.PI / 360));
const latitudeAt = y => Math.atan(Math.exp(y)) * 360 / Math.PI - 90;

/** Render in Web Mercator, matching Leaflet tiles, with a bounded pixel budget. */
export function rasterizeField(field, metric, { width, height, bounds, cellSize = 2 }) {
  if (!isNumber(width) || !isNumber(height) || width <= 0 || height <= 0 || !Object.hasOwn(METRICS, metric)) throw new Error('Invalid raster dimensions');
  if (!bounds || ![bounds.south, bounds.north, bounds.west, bounds.east].every(isNumber) || bounds.north <= bounds.south || bounds.east <= bounds.west) throw new Error('Invalid raster bounds');
  if (!isNumber(cellSize)) throw new Error('Invalid display cell size');
  let pixelSize = Math.max(clamp(Math.round(cellSize), 1, 12), Math.ceil(Math.sqrt(width * height / 1200000)));
  while (Math.ceil(width / pixelSize) * Math.ceil(height / pixelSize) > 1200000) pixelSize++;
  const cols = Math.ceil(width / pixelSize), rows = Math.ceil(height / pixelSize);
  const data = new Uint8ClampedArray(cols * rows * 4), palette = paletteFor(metric), spec = METRICS[metric];
  const top = mercator(bounds.north), bottom = mercator(bounds.south);
  for (let y = 0; y < rows; y++) {
    const lat = latitudeAt(top + (y + .5) / rows * (bottom - top));
    for (let x = 0; x < cols; x++) {
      const lon = bounds.west + (x + .5) / cols * (bounds.east - bounds.west);
      const value = interpolateField(field, lat, lon, metric);
      if (!isNumber(value)) continue;
      const color = palette[Math.round(clamp((value - spec.min) / (spec.max - spec.min), 0, 1) * (palette.length - 1))], at = (y * cols + x) * 4;
      data[at] = color[0]; data[at + 1] = color[1]; data[at + 2] = color[2]; data[at + 3] = 255;
    }
  }
  return { width: cols, height: rows, data, pixelSize };
}

export function zoomEarthURL(place, zoom = 6, metric = 'temperature') {
  const path = { temperature: 'temperature', humidity: 'humidity', wind: 'wind-speed', rain: 'precipitation' }[metric] || 'temperature';
  const url = new URL(`https://zoom.earth/maps/${path}/`);
  url.hash = `view=${place.lat.toFixed(3)},${normalizeLongitude(place.lon).toFixed(3)},${clamp(Math.round(zoom), 2, 12)}z/model=icon`;
  return url.href;
}
