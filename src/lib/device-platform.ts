export type DevicePlatform = 'ios' | 'android' | 'mac-safari' | 'desktop';
export type DesktopBrowser = 'chrome' | 'edge' | 'safari' | 'other';
export function desktopBrowser(userAgent: string): DesktopBrowser {
  if (/Edg\//i.test(userAgent)) return 'edge';
  if (/Chrome|Chromium/i.test(userAgent)) return 'chrome';
  if (/Safari/i.test(userAgent)) return 'safari';
  return 'other';
}

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
