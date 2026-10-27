// Distance à vol d'oiseau (Haversine) — utilisée pour des vérifications de
// plausibilité ponctuelles (ETA, position au scan QR), jamais pour un
// pistage en continu. Partagée entre DepartureBar et le scan QR.
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Position ponctuelle (un seul relevé, pas un suivi) — résout toujours,
// jamais de rejet qui bloquerait un scan QR légitime en cas de refus de
// permission ou de délai dépassé.
export function getOneShotPosition(timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs },
    )
  })
}
