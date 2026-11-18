// Fond de carte vectoriel aux couleurs PING (référence : buildMap de l'animation de marque,
// brand/anim-presentation/parts/d_scenes.js) : terre vert très clair, eau bleu clair, routes
// blanches arrondies, très peu de détails, pas de POI.
// Données : tuiles vectorielles OpenFreeMap (schéma OpenMapTiles, données OpenStreetMap) —
// sans clé, usage commercial permis, attribution obligatoire (voir MAP_ATTRIBUTION).
// Polices : seules celles servies par OpenFreeMap sont disponibles (Noto Sans) ; Inter n'y est pas.

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'

const LAND = '#E9F1EA'
const WATER = '#CBE6EE'
const GREEN = '#D6E9D2'
const BUILDING = '#DEE8DF'
const ROAD = '#FFFFFF'
const LABEL = '#6E8592'
const LABEL_SOFT = '#8A9CA5'
const WATER_LABEL = '#7FA6B4'
const HALO = 'rgba(255,255,255,.9)'

const NAME = ['coalesce', ['get', 'name:fr'], ['get', 'name:latin'], ['get', 'name']]
const POLY = ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false]
const LINE = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false]

// Largeur de route en fonction du zoom (exponentielle, comme les styles OpenMapTiles).
function width(stops: [number, number][]) {
  return ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()]
}

function road(id: string, classes: string[], minzoom: number, stops: [number, number][]) {
  return {
    id,
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    minzoom,
    filter: ['all', LINE, ['match', ['get', 'class'], classes, true, false]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROAD,
      // Tunnels estompés, le reste plein.
      'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 1],
      'line-width': width(stops),
    },
  }
}

// Typage volontairement souple (StyleSpecification de maplibre-gl) : le module reste importable
// sans charger maplibre-gl dans le bundle principal.
export const PING_MAP_STYLE: any = {
  version: 8,
  name: 'PING',
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': LAND } },
    {
      id: 'greens', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
      filter: ['all', POLY, ['match', ['get', 'class'], ['wood', 'grass'], true, false]],
      paint: { 'fill-color': GREEN, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 12, 0.85] },
    },
    {
      id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park',
      filter: POLY,
      paint: { 'fill-color': GREEN },
    },
    {
      id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
      filter: ['all', POLY, ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'fill-color': WATER },
    },
    {
      id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
      minzoom: 11,
      filter: ['all', LINE, ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': WATER, 'line-width': width([[11, 0.8], [16, 3], [18, 6]]) },
    },
    {
      // Bâtiments à peine visibles, seulement de près.
      id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building',
      minzoom: 15,
      paint: { 'fill-color': BUILDING, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16.5, 0.8] },
    },
    road('road-service', ['service', 'track'], 15, [[15, 1.2], [18, 7]]),
    road('road-minor', ['minor'], 12, [[12, 0.5], [14, 1.4], [16, 4.5], [18, 14]]),
    road('road-tertiary', ['tertiary'], 10, [[10, 0.6], [13, 2.4], [15, 6.5], [18, 20]]),
    road('road-secondary', ['secondary', 'primary'], 8, [[8, 0.6], [11, 2], [13, 4], [15, 9], [18, 26]]),
    road('road-major', ['trunk', 'motorway'], 6, [[6, 0.6], [10, 2.2], [13, 4.8], [15, 10], [18, 30]]),
    {
      id: 'road-name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name',
      minzoom: 14,
      filter: ['all', LINE, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false]],
      layout: {
        'symbol-placement': 'line',
        'text-field': NAME,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10.5, 18, 13],
        'text-letter-spacing': 0.02,
        'text-rotation-alignment': 'map',
      },
      paint: { 'text-color': LABEL_SOFT, 'text-halo-color': HALO, 'text-halo-width': 1.4 },
    },
    {
      id: 'water-name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
      // Mer et baies seulement (les fontaines et bassins sont classés « lake »).
      minzoom: 7,
      filter: ['all', ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false], ['match', ['get', 'class'], ['ocean', 'sea', 'bay'], true, false]],
      layout: {
        'text-field': NAME,
        'text-font': ['Noto Sans Italic'],
        'text-size': 12,
        'text-letter-spacing': 0.08,
        'text-max-width': 6,
      },
      paint: { 'text-color': WATER_LABEL, 'text-halo-color': 'rgba(203,230,238,.8)', 'text-halo-width': 1 },
    },
    {
      // Quartiers, de près seulement.
      id: 'place-quarter', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      minzoom: 13,
      filter: ['match', ['get', 'class'], ['suburb', 'quarter', 'neighbourhood'], true, false],
      layout: {
        'text-field': NAME,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10.5, 17, 13],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
      },
      paint: { 'text-color': LABEL_SOFT, 'text-halo-color': HALO, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-village', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      minzoom: 11,
      filter: ['match', ['get', 'class'], ['village'], true, false],
      layout: {
        'text-field': NAME,
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 14],
        'text-max-width': 8,
      },
      paint: { 'text-color': LABEL, 'text-halo-color': HALO, 'text-halo-width': 1.5 },
    },
    {
      id: 'place-town', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      minzoom: 7,
      filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
      layout: {
        'text-field': NAME,
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 11, 11, 14, 15, 17],
        'text-max-width': 8,
      },
      paint: { 'text-color': LABEL, 'text-halo-color': HALO, 'text-halo-width': 1.6 },
    },
  ],
}

// WebGL disponible ? (sinon : repli immédiat sur les tuiles raster).
export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
