import { describe, expect, it } from 'vitest';
import {
  ageInDays,
  safeReturnPath,
  dateInTimeZone,
} from '../../src/lib/domain';

describe('calendar rules', () => {
  it('counts calendar days including leap days without timezone shifts', () => {
    expect(ageInDays('2024-02-28', '2024-03-01')).toBe(2);
  });
  it('uses local calendar dates when displaying today', () => {
    expect(dateInTimeZone(new Date('2026-10-11T16:00:00Z'), 'Asia/Seoul')).toBe(
      '2026-10-12',
    );
  });
});

describe('OAuth return routes', () => {
  it('allows the locale and invitation to survive login', () => {
    expect(safeReturnPath('/en/invite/abc', 'en')).toBe('/en/invite/abc');
  });
  it.each([
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/ko/../auth',
    '/en/today',
    '/ko/%2f%2fevil',
  ])('rejects unsafe or cross-locale return routes: %s', (path) => {
    expect(safeReturnPath(path, 'ko')).toBe('/ko/today');
  });
});

import { hasRecentAuthentication } from '../../src/lib/domain';
it('requires current-session authentication rather than account-wide sign-in', () => {
  const now = Date.parse('2026-10-12T00:10:00Z');
  const at = (time: string) => [
    { method: 'oauth', timestamp: Date.parse(time) / 1000 },
  ];
  expect(hasRecentAuthentication(at('2026-10-12T00:09:00Z'), now)).toBe(true);
  expect(hasRecentAuthentication(at('2026-10-12T00:04:00Z'), now)).toBe(false);
  expect(hasRecentAuthentication(at('2026-10-12T00:11:00Z'), now)).toBe(false);
  expect(hasRecentAuthentication(['oauth'], now)).toBe(false);
  expect(hasRecentAuthentication(undefined, now)).toBe(false);
  expect(
    hasRecentAuthentication(
      [{ method: 'token_refresh', timestamp: now / 1000 }],
      now,
    ),
  ).toBe(false);
});
