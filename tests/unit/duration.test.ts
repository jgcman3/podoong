import { expect, test } from 'vitest';
import { formatCareDuration } from '@/lib/duration';

test('care durations use hours and remaining minutes without seconds', () => {
  expect(formatCareDuration(70, 'ko')).toBe('1시간 10분');
  expect(formatCareDuration(630, 'ko')).toBe('10시간 30분');
  expect(formatCareDuration(60, 'ko')).toBe('1시간');
  expect(formatCareDuration(30, 'ko')).toBe('30분');
  expect(formatCareDuration(70.9, 'en')).toBe('1h 10m');
  expect(formatCareDuration(0, 'ko')).toBe('0분');
});
