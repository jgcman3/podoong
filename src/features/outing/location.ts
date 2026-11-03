let pending: Promise<GeolocationPosition | null> | undefined;
let recent: { position: GeolocationPosition; expires: number } | undefined;
let generation = 0;
export function hasPendingOutingLocation() {
  return Boolean(pending);
}
// Hand the Start gesture's result to the strip even when saving finishes later.
export function recentOutingLocation() {
  if (recent && recent.expires > Date.now()) return recent.position;
  recent = undefined;
}
export function clearOutingLocation() {
  generation++;
  recent = undefined;
}
// Never block saving an outing on a denied or unavailable location request.
export function requestOutingLocation(): Promise<GeolocationPosition | null> {
  if (pending) return pending;
  if (!window.isSecureContext || !navigator.geolocation)
    return Promise.resolve(null);
  const started = generation;
  const result = new Promise<GeolocationPosition | null>((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 10000,
      });
    } catch {
      resolve(null);
    }
  }).then((position) => {
    if (position && generation === started)
      recent = { position, expires: Date.now() + 60000 };
    return position;
  });
  pending = result;
  void result.finally(() => {
    if (pending === result) pending = undefined;
  });
  return result;
}
