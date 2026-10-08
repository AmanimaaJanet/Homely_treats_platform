/**
 * Geography for the live rider card — small, exact, and unit-tested, because
 * "your rider is 2 km away" is only useful if it really is about 2 km.
 */

/** Great-circle distance between two points, in kilometres. */
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's mean radius, km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Rough minutes until arrival. Accra traffic averages ~20-25 km/h for a bike or
 * scooter in the delivery zones; 22 is the working assumption, and the UI presents
 * the result as "about", not a promise.
 */
export function etaMinutes(km) {
  return Math.max(1, Math.round((km / 22) * 60));
}

/** "850 m" / "1.8 km" — people don't read "0.85 km" as quickly. */
export function formatKm(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
