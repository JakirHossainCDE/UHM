import { rasterizeField } from './surface.js?v=2.2.0';

/** One bounded canvas, not thousands of SVG rectangles or external tile requests. */
export function createSurfaceLayer(L) {
  const Surface = L.Layer.extend({
    initialize() { this._field = null; this._settings = {}; },
    onAdd(map) {
      this._map = map;
      this._canvas = L.DomUtil.create('canvas', 'weather-surface leaflet-zoom-hide');
      this._canvas.setAttribute('aria-hidden', 'true');
      this._canvas.style.pointerEvents = 'none';
      this.getPane().appendChild(this._canvas);
      this._context = this._canvas.getContext('2d');
      this._redraw();
    },
    onRemove() { this._canvas?.remove(); this._map = null; },
    getEvents() { return { resize: this._redraw, zoomstart: this._hide }; },
    _hide() { if (this._canvas) this._canvas.style.visibility = 'hidden'; },
    available() { return Boolean(this._context); },
    setField(field, settings = {}) { this._field = field; this._settings = settings; this._redraw(); return this; },
    _redraw() {
      if (!this._map || !this._canvas) return;
      const { metric = 'temperature', mode = 'smooth', cellSize = 2, opacity = .62 } = this._settings;
      if (!this._field || !this._context || mode === 'samples') { this._canvas.hidden = true; return; }
      const size = this._map.getSize();
      if (!size.x || !size.y) return;
      const b = this._map.getBounds();
      const key = [size.x, size.y, b.getSouth(), b.getNorth(), b.getWest(), b.getEast(), metric, cellSize].join(',');
      this._canvas.style.opacity = String(opacity);
      this._canvas.style.imageRendering = mode === 'grid' ? 'pixelated' : 'auto';
      this._canvas.dataset.mode = mode;
      this._canvas.hidden = false; this._canvas.style.visibility = '';
      if (this._paintedField === this._field && this._paintedKey === key) return;
      const raster = rasterizeField(this._field, metric, { width: size.x, height: size.y, cellSize,
        bounds: { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() } });
      this._canvas.width = raster.width; this._canvas.height = raster.height;
      this._canvas.style.width = `${size.x}px`; this._canvas.style.height = `${size.y}px`;
      this._canvas.style.opacity = String(opacity);
      this._canvas.style.imageRendering = mode === 'grid' ? 'pixelated' : 'auto';
      this._canvas.dataset.pixelSize = String(raster.pixelSize);
      this._canvas.dataset.surfaceMetric = metric; this._canvas.dataset.mode = mode;
      L.DomUtil.setPosition(this._canvas, this._map.containerPointToLayerPoint([0, 0]));
      const pixels = this._context.createImageData(raster.width, raster.height);
      pixels.data.set(raster.data);
      this._context.putImageData(pixels, 0, 0);
      this._paintedField = this._field; this._paintedKey = key;
      this._canvas.hidden = false; this._canvas.style.visibility = '';
    },
  });
  return new Surface({ pane: 'overlayPane' });
}
