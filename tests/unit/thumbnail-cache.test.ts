import { afterEach, expect, it, vi } from 'vitest';
import {
  readThumbnail,
  rememberThumbnail,
} from '@/features/growth-community/thumbnail-cache';
afterEach(() => vi.useRealTimers());
it('reuses a loaded image only within the same login session', () => {
  readThumbnail('session-a', '/photo');
  rememberThumbnail('session-a', '/photo', 'data:image/webp;base64,one');
  expect(readThumbnail('session-a', '/photo')).toContain('one');
  expect(readThumbnail('session-b', '/photo')).toBeUndefined();
  rememberThumbnail('session-a', '/late-photo', 'data:image/webp;base64,late');
  expect(readThumbnail('session-b', '/late-photo')).toBeUndefined();
  expect(readThumbnail('session-a', '/photo')).toBeUndefined();
});
it('expires previews and bounds retained entries', () => {
  vi.useFakeTimers();
  readThumbnail('expiry', 'start');
  for (let i = 0; i < 81; i++)
    rememberThumbnail('expiry', `/${i}`, `data:image/webp;base64,${i}`);
  expect(readThumbnail('expiry', '/0')).toBeUndefined();
  expect(readThumbnail('expiry', '/80')).toBeDefined();
  vi.advanceTimersByTime(5 * 60 * 1000);
  expect(readThumbnail('expiry', '/80')).toBeUndefined();
});
