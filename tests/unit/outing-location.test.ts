import { afterEach, expect, it, vi } from 'vitest';
import {
  requestOutingLocation,
  hasPendingOutingLocation,
  recentOutingLocation,
  clearOutingLocation,
} from '@/features/outing/location';
afterEach(() => {
  clearOutingLocation();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('requests location synchronously from the start gesture and reuses an outstanding prompt', async () => {
  let resolve!: PositionCallback;
  const getCurrentPosition = vi.fn((success: PositionCallback) => {
    resolve = success;
  });
  vi.stubGlobal('window', { isSecureContext: true });
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  const first = requestOutingLocation();
  expect(getCurrentPosition).toHaveBeenCalledOnce();
  expect(hasPendingOutingLocation()).toBe(true);
  expect(requestOutingLocation()).toBe(first);
  const position = {
    coords: { latitude: 37, longitude: 127 },
  } as GeolocationPosition;
  resolve(position);
  expect(await first).toBe(position);
  await Promise.resolve();
  expect(hasPendingOutingLocation()).toBe(false);
  // Saving may finish after the permission callback has already settled.
  expect(recentOutingLocation()).toBe(position);
  clearOutingLocation();
  expect(recentOutingLocation()).toBeUndefined();
});
it('does not fail outing saving when location is denied or the page is insecure', async () => {
  vi.stubGlobal('window', { isSecureContext: false });
  const getCurrentPosition = vi.fn();
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
  expect(await requestOutingLocation()).toBeNull();
  expect(getCurrentPosition).not.toHaveBeenCalled();
  vi.stubGlobal('window', { isSecureContext: true });
  getCurrentPosition.mockImplementation((_success, error) =>
    error({ code: 1 }),
  );
  expect(await requestOutingLocation()).toBeNull();
});

it('expires the gesture handoff and discards a result after an outing is stopped', async () => {
  vi.useFakeTimers();
  let resolve!: PositionCallback;
  vi.stubGlobal('window', { isSecureContext: true });
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (success: PositionCallback) => {
        resolve = success;
      },
    },
  });
  const position = {
    coords: { latitude: 37, longitude: 127 },
  } as GeolocationPosition;
  const first = requestOutingLocation();
  resolve(position);
  await first;
  expect(recentOutingLocation()).toBe(position);
  vi.advanceTimersByTime(60001);
  expect(recentOutingLocation()).toBeUndefined();
  const second = requestOutingLocation();
  clearOutingLocation();
  resolve(position);
  await second;
  expect(recentOutingLocation()).toBeUndefined();
});
