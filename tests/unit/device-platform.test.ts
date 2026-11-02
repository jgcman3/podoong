import { describe, expect, it } from 'vitest';
import { devicePlatform, inAppBrowser } from '@/lib/device-platform';

describe('installation and notification platform guides', () => {
  it('recognizes KakaoTalk on iOS and Android without confusing ordinary Safari or Chrome', () => {
    const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1) Safari/604.1';
    const android =
      'Mozilla/5.0 (Linux; Android 14; wv) Chrome/126.0.6478.134 Mobile Safari/537.36';
    expect(inAppBrowser(ios + ' KAKAOTALK/10.8.2 (INAPP)')).toBe('kakaotalk');
    expect(inAppBrowser(android + ' KAKAOTALK/10.8.3 (INAPP)')).toBe(
      'kakaotalk',
    );
    expect(inAppBrowser(ios)).toBeNull();
    expect(inAppBrowser(android)).toBeNull();
    expect(inAppBrowser('')).toBeNull();
  });
  it.each([
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0) Safari/604.1',
      'iPhone',
      5,
      'ios',
    ],
    ['Mozilla/5.0 (Macintosh) Version/26.0 Safari/605.1', 'MacIntel', 5, 'ios'],
    [
      'Mozilla/5.0 (Linux; Android 16) Chrome/130.0 Mobile Safari/537.36',
      'Linux arm',
      5,
      'android',
    ],
    [
      'Mozilla/5.0 (Macintosh) Version/26.0 Safari/605.1',
      'MacIntel',
      0,
      'mac-safari',
    ],
    [
      'Mozilla/5.0 (Macintosh) Chrome/130.0 Safari/537.36',
      'MacIntel',
      0,
      'desktop',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130',
      'Win32',
      0,
      'desktop',
    ],
  ])('detects %s', (ua, platform, touches, expected) => {
    expect(devicePlatform(ua, platform, touches)).toBe(expected);
  });
});
