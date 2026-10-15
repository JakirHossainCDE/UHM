import test from 'node:test';
import assert from 'node:assert/strict';
import { surfaceSampleGrid, createField, interpolateField, rasterizeField, zoomEarthURL } from '../modules/surface.js';
import { METRICS, metricColor } from '../modules/core.js';

const bounds = { south: 0, north: 10, west: 20, east: 30 };
const fieldAt = (area = bounds, valueAt = p => p.lat + p.displayLon, size = 9) => createField(surfaceSampleGrid(area, size).map(p => ({
  ...p, time: 1000, airTime: 1000, rainTime: 1000,
  values: Object.fromEntries(Object.keys(METRICS).map(metric => [metric, valueAt(p)])),
})));
const rgb = color => color.startsWith('#') ? [1,3,5].map(i => parseInt(color.slice(i,i+2),16)) : color.match(/[\d.]+/g).map(Number);

test('81 sample nodes cover every edge of the view without exceeding valid coordinates', () => {
  const points = surfaceSampleGrid(bounds);
  assert.equal(points.length, 81);
  assert.deepEqual([points[0].lat, points[0].displayLon], [0,20]);
  assert.deepEqual([points[80].lat, points[80].displayLon], [10,30]);
  const polar = surfaceSampleGrid({ south:-90,north:90,west:-540,east:540 });
  assert(polar.every(p => p.lat >= -85 && p.lat <= 85 && p.lon >= -180 && p.lon <= 180));
  assert.equal(polar[80].displayLon - polar[0].displayLon,360);
  assert.throws(() => surfaceSampleGrid(bounds,100), /Invalid/);
  assert.throws(() => surfaceSampleGrid({...bounds,north:NaN}), /Invalid/);
});
test('fields reject incomplete or reordered grids', () => {
  const points = fieldAt().points;
  assert.equal(createField(points.slice(1)),null);
  assert.equal(createField([...points].reverse()),null);
  assert.equal(createField([]),null);
});
test('bilinear interpolation reproduces source nodes and a linear surface for all metrics', () => {
  const field = fieldAt();
  for (const metric of Object.keys(METRICS)) {
    assert.equal(interpolateField(field,0,20,metric),20);
    assert.equal(interpolateField(field,10,30,metric),40);
    assert(Math.abs(interpolateField(field,3.3,24.6,metric)-27.9)<1e-8);
  }
});
test('no extrapolation occurs outside the sampled area', () => {
  const field = fieldAt();
  for (const [lat,lon] of [[-1,25],[11,25],[5,19],[5,31]]) assert.equal(interpolateField(field,lat,lon,'temperature'),null);
  assert.equal(interpolateField(field,5,25,'unknown'),null);
});
test('missing corners and conflicting model times leave holes, while real zero stays zero', () => {
  const field = fieldAt(bounds, () => 0,2);
  assert.equal(interpolateField(field,5,25,'temperature'),0);
  field.points[3].values.temperature=null;
  assert.equal(interpolateField(field,5,25,'temperature'),null);
  assert.equal(interpolateField(field,0,20,'temperature'),0, 'An unrelated missing node does not hide an exact source value');
  assert.equal(interpolateField(field,5,25,'humidity'),0);
  field.points[3].time=4600;
  assert.equal(interpolateField(field,5,25,'humidity'),null);
  assert.equal(interpolateField(field,5,25,'aqi'),0, 'CAMS timestamps are independent');
  field.points[3].rainTime=null;
  assert.equal(interpolateField(field,5,25,'rain'),null);
});
test('interpolation crosses the antimeridian and follows repeated map worlds', () => {
  const field = fieldAt({south:0,north:10,west:175,east:-175}, p => p.displayLon,2);
  assert.equal(interpolateField(field,5,-178,'temperature'),182);
  assert.equal(interpolateField(field,5,542,'temperature'),182);
  assert.equal(interpolateField(field,5,160,'temperature'),null);
});
test('raster projection uses Web Mercator, north at the top and the model colours', () => {
  const area = {south:0,north:80,west:0,east:10}, field=fieldAt(area,p=>p.lat,2);
  const raster=rasterizeField(field,'humidity',{width:1,height:1,bounds:area,cellSize:1});
  const expected=rgb(metricColor(57.04516467328689,'humidity'));
  assert(raster.data.slice(0,3).every((v,i)=>Math.abs(v-expected[i])<=1));
  assert.equal(raster.data[3],255);
  const split=rasterizeField(field,'humidity',{width:1,height:2,bounds:area,cellSize:1});
  const north=rgb(metricColor(71.72271763691002,'humidity'));
  const south=rgb(metricColor(32.9199069835524,'humidity'));
  assert(split.data.slice(0,3).every((v,i)=>Math.abs(v-north[i])<=1));
  assert(split.data.slice(4,7).every((v,i)=>Math.abs(v-south[i])<=1));
});
test('raster leaves unavailable and out-of-view regions transparent', () => {
  const field=fieldAt(bounds,()=>null,2);
  let raster=rasterizeField(field,'rain',{width:4,height:4,bounds,cellSize:1});
  assert(raster.data.every(v=>v===0));
  raster=rasterizeField(fieldAt(bounds,()=>0,2),'rain',{width:4,height:4,bounds:{...bounds,west:10,east:20},cellSize:1});
  assert(raster.data.every(v=>v===0));
});
test('AQI raster preserves exact category transitions without palette quantisation errors', () => {
  for (const threshold of [50,100,150,200,300]) for (const value of [threshold+.49,threshold+.5]) {
    const raster=rasterizeField(fieldAt(bounds,()=>value,2),'aqi',{width:1,height:1,bounds,cellSize:1});
    assert.deepEqual([...raster.data.slice(0,3)],rgb(metricColor(value,'aqi')));
  }
});
test('one-pixel detail is available, coarser display reduces work, and large screens stay bounded', () => {
  const field=fieldAt();
  const fine=rasterizeField(field,'temperature',{width:12,height:8,bounds,cellSize:1});
  const coarse=rasterizeField(field,'temperature',{width:12,height:8,bounds,cellSize:4});
  assert.deepEqual([fine.width,fine.height,fine.pixelSize],[12,8,1]);
  assert.deepEqual([coarse.width,coarse.height,coarse.pixelSize],[3,2,4]);
  const large=rasterizeField(null,'temperature',{width:3840,height:2160,bounds,cellSize:1});
  assert(large.width*large.height<=1200000); assert(large.pixelSize>1);
});
test('invalid raster requests fail safely', () => {
  for (const options of [{width:0,height:1,bounds}, {width:2,height:2,bounds:{}}, {width:2,height:2,bounds,cellSize:NaN}])
    assert.throws(()=>rasterizeField(fieldAt(),'temperature',options),/Invalid/);
});
test('Zoom Earth comparison URLs map each supported layer and validate zoom and longitude', () => {
  for (const [metric,path] of Object.entries({temperature:'temperature',humidity:'humidity',wind:'wind-speed',rain:'precipitation'})) {
    const url=new URL(zoomEarthURL({lat:41.882,lon:372.487},50,metric));
    assert.equal(url.pathname,`/maps/${path}/`);
    assert.equal(url.hash,'#view=41.882,12.487,12z/model=icon');
  }
});
