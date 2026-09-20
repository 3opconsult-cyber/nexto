// Repli manuel quand la géolocalisation navigateur est refusée/indisponible
// (poste fixe, permission bloquée) — sans ça, l'étape "Où intervenez-vous ?"
// de l'onboarding pro n'avait aucune issue de secours. API Nominatim
// (OpenStreetMap, publique, gratuite, sans clé) — cohérent avec le reste
// de la stack carte (Leaflet + OSM). Défensif comme legalLookup.ts : en cas
// d'échec, on renvoie null plutôt que de bloquer l'inscription.
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim()
  if (q.length < 3) return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr&q=${encodeURIComponent(q)}`,
      { headers: { 'Accept-Language': 'fr' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const first = Array.isArray(data) ? data[0] : null
    if (!first) return null
    const lat = Number(first.lat)
    const lng = Number(first.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}
