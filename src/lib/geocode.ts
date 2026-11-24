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

// « 12 chemin X, 06130 Grasse » → « 06130 Grasse » ; sans code postal, la dernière partie après une virgule.
// Repli quand l'adresse complète n'est pas reconnue (rue inconnue de la base, numéro mal saisi).
export function addressLocality(address: string) {
  const m = address.match(/\b\d{5}\b[^,]*/)
  if (m) return m[0].trim()
  const parts = address.split(',').map(x => x.trim()).filter(Boolean)
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

// ---------------------------------------------------------------------------
// Autocomplétion de l'adresse de référence (24/11/2026). Même service que geocodeAddress (Nominatim, sans clé),
// mais PLUSIEURS propositions, chacune avec son point : l'utilisateur voit le point trouvé AVANT de valider
// (une ville seule ou une rue ambiguë ne tombe plus silencieusement au mauvais endroit). Résultats classés
// d'abord autour de la Côte d'Azur (viewbox non bloquante : une adresse ailleurs en France reste trouvée).
// ---------------------------------------------------------------------------
export type AddressHit = {
  label: string            // « 2 rue de l’Audit, 06130 Grasse »
  lat: number
  lng: number
  city: string             // ville seule (peut être vide)
  precise: boolean         // vrai si le résultat est une adresse (rue + numéro) et non une ville ou une rue entière
  kind: 'adresse' | 'rue' | 'ville'
}

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressHit[]> {
  const q = query.trim()
  if (q.length < 3) return []
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=fr&viewbox=5.6,44.3,8.0,43.0&bounded=0&q=${encodeURIComponent(q)}`,
      { headers: { 'Accept-Language': 'fr' }, signal },
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    const out: AddressHit[] = []
    for (const r of data) {
      const lat = Number(r.lat), lng = Number(r.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const a = r.address || {}
      const city = String(a.city || a.town || a.village || a.municipality || a.hamlet || '').trim()
      const road = String(a.road || a.pedestrian || a.footway || '').trim()
      const num = String(a.house_number || '').trim()
      const cp = String(a.postcode || '').trim()
      const kind: AddressHit['kind'] = num && road ? 'adresse' : road ? 'rue' : 'ville'
      const street = [num, road].filter(Boolean).join(' ')
      const place = [cp, city].filter(Boolean).join(' ')
      const label = [street, place].filter(Boolean).join(', ') || String(r.display_name || '').split(',').slice(0, 3).join(',').trim()
      if (!label || out.some(o => o.label === label)) continue
      out.push({ label, lat, lng, city, precise: kind === 'adresse', kind })
    }
    return out
  } catch {
    return []
  }
}
