import { describe, it, expect } from 'vitest';
import { careElapsed, careDuration } from '@/features/care/last-care-model';
describe('last care elapsed time', () => {
  const at = '2026-10-25T15:00:00Z';
  it('uses elapsed minutes, hours and days across a local midnight', () => {
    const instant = Date.parse(at);
    expect(careElapsed(at, instant + 30000, 'ko')).toBe('방금');
    expect(careElapsed(at, instant + 15 * 60000, 'ko')).toBe('15분 전');
    expect(careElapsed(at, instant + 70 * 60000, 'ko')).toBe('1시간 10분 전');
    expect(careElapsed(at, instant + 2 * 86400000, 'ko')).toBe('2일 전');
    expect(careElapsed(at, instant - 30000, 'ko')).toBe('방금');
    expect(careElapsed(at, instant + 15 * 60000, 'en')).toBe('15 min ago');
  });
  it('keeps sleep durations separate from time since waking', () => {
    expect(careDuration(80, 'ko')).toBe('1시간 20분');
    expect(careDuration(0.2, 'ko')).toBe('1분 미만');
  });
});
