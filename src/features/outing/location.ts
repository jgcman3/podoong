let pending: Promise<GeolocationPosition | null> | undefined;
export function hasPendingOutingLocation() {
  return Boolean(pending);
}
// Invoke synchronously from the Start outing submit gesture. Never block saving
// the outing on a denied, unavailable or dismissed location request.
export function requestOutingLocation(): Promise<GeolocationPosition | null> {
  if (pending) return pending;
  if (!window.isSecureContext || !navigator.geolocation)
    return Promise.resolve(null);
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
  });
  pending = result;
  void result.finally(() => {
    if (pending === result) pending = undefined;
  });
  return result;
}
