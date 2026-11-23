// Distance à vol d'oiseau (Haversine) — utilisée pour des vérifications de plausibilité ponctuelles (ETA de
// « Je pars », comparaison position / adresse), jamais pour un pistage en continu. Partagée entre DepartureBar
// et la route /api/arrival (via arrival.ts).
// La lecture de la position de l'appareil n'est PAS ici : voir src/lib/position.ts (arrivée client absent, zone
// « en intervention ici »). `getOneShotPosition` (jamais appelée, son commentaire annonçait à tort une position
// relevée au scan QR) a été retirée le 23/11/2026 : le scan QR ne lit aucune position.
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
