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
const LABEL = '#4E6470'
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


// Variante « conviviale » inspirée de Waze (demande Romain 22/11/2026) : fond gris-bleu très clair, routes blanches avec
// liseré gris, axes principaux jaunes puis orange, eau bleue franche, parcs verts, noms plus gros et foncés avec contour
// blanc épais. Mêmes tuiles gratuites OpenFreeMap, aucun service payant. Choix : défaut PING_MAP_STYLE ; essai en ligne
// avec ?carte=waze (voir pickMapStyle).
const W = {
  land: '#EEF1F5', water: '#9FD6F0', green: '#CDE9C4', building: '#E1E5EB',
  casing: '#C7CED6', minor: '#FFFFFF', second: '#FFF1B8', secondCase: '#E6C766', major: '#FFC94D', majorCase: '#E39A1D',
  label: '#3A4752', labelSoft: '#5B6A76', halo: 'rgba(255,255,255,.95)', waterLabel: '#4D86A8',
}
function wazeRoad(id: string, classes: string[], minzoom: number, stops: [number, number][], fill: string, edge: string, extra: number) {
  const casing = {
    id: id + '-casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom,
    filter: ['all', LINE, ['match', ['get', 'class'], classes, true, false]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': edge,
      'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.4, 1],
      'line-width': width(stops.map(([z, w]) => [z, w + extra * (z >= 14 ? 1 : 0.6)] as [number, number])),
    },
  }
  const inner: any = road(id, classes, minzoom, stops)
  inner.paint['line-color'] = fill
  return [casing, inner]
}
export function buildWazeStyle(): any {
  const base: any = JSON.parse(JSON.stringify(PING_MAP_STYLE))
  const layers: any[] = []
  for (const l of base.layers) {
    if (l.id === 'background') l.paint['background-color'] = W.land
    else if (l.id === 'greens' || l.id === 'park') l.paint['fill-color'] = W.green
    else if (l.id === 'water') l.paint['fill-color'] = W.water
    else if (l.id === 'waterway') l.paint['line-color'] = W.water
    else if (l.id === 'building') l.paint['fill-color'] = W.building
    else if (l.id === 'road-service') { layers.push(...wazeRoad('road-service', ['service', 'track'], 15, [[15, 1.2], [18, 7]], W.minor, W.casing, 1.4)); continue }
    else if (l.id === 'road-minor') { layers.push(...wazeRoad('road-minor', ['minor'], 12, [[12, 0.7], [14, 1.8], [16, 5.5], [18, 16]], W.minor, W.casing, 1.6)); continue }
    else if (l.id === 'road-tertiary') { layers.push(...wazeRoad('road-tertiary', ['tertiary'], 10, [[10, 0.8], [13, 2.8], [15, 7.5], [18, 22]], W.minor, W.casing, 1.8)); continue }
    else if (l.id === 'road-secondary') { layers.push(...wazeRoad('road-secondary', ['secondary', 'primary'], 8, [[8, 0.8], [11, 2.4], [13, 4.8], [15, 10], [18, 28]], W.second, W.secondCase, 2)); continue }
    else if (l.id === 'road-major') { layers.push(...wazeRoad('road-major', ['trunk', 'motorway'], 6, [[6, 0.8], [10, 2.6], [13, 5.6], [15, 11], [18, 32]], W.major, W.majorCase, 2.2)); continue }
    else if (l.type === 'symbol') {
      l.paint['text-color'] = l.id === 'water-name' ? W.waterLabel : (l.id === 'road-name' || l.id === 'place-quarter' ? W.labelSoft : W.label)
      l.paint['text-halo-color'] = l.id === 'water-name' ? 'rgba(159,214,240,.85)' : W.halo
      l.paint['text-halo-width'] = 2
      if (l.layout['text-font']) l.layout['text-font'] = l.id === 'water-name' ? ['Noto Sans Italic'] : ['Noto Sans Bold']
      if (Array.isArray(l.layout['text-size'])) l.layout['text-size'] = l.layout['text-size'].map((v: any, k: number) => (k >= 4 && k % 2 === 0 && typeof v === 'number' ? v + 1.5 : v))
      else if (typeof l.layout['text-size'] === 'number') l.layout['text-size'] += 1.5
    }
    layers.push(l)
  }
  base.layers = layers
  base.name = 'PING Waze'
  return base
}

// Style choisi : PING (défaut) ou Waze (essai avec ?carte=waze, mémorisé sur l'appareil).
export function pickMapStyle(): any {
  try {
    const q = new URLSearchParams(window.location.search).get('carte')
    if (q === 'waze' || q === 'ping') localStorage.setItem('ping_map_style', q)
    const v = q || localStorage.getItem('ping_map_style')
    // Décision de Romain (23/11) : le style Waze est le style par défaut ; ?carte=ping garde l'ancien style clair.
    if (v !== 'ping') return buildWazeStyle()
  } catch { return buildWazeStyle() }
  return PING_MAP_STYLE
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
