export type DevicePlatform = 'ios' | 'android' | 'mac-safari' | 'desktop';

export function devicePlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): DevicePlatform {
  if (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  )
    return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  if (
    /Macintosh/.test(userAgent) &&
    /Safari/.test(userAgent) &&
    !/Chrome|Chromium|Edg|OPR/.test(userAgent)
  )
    return 'mac-safari';
  return 'desktop';
}
