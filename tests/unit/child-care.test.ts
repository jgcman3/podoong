import { describe, expect, it } from 'vitest';
import { childRecordSchema, imageType } from '@/features/child-care/schema';
const base = {
  id: '30000000-0000-4000-8000-000000000001',
  childId: '20000000-0000-4000-8000-000000000001',
  occurredAt: '2026-10-13T23:30:00Z',
  timezone: 'Asia/Seoul',
};
describe('child care entry validation', () => {
  it('accepts sleep across midnight and an active timer without inventing an end', () => {
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'sleep',
        kind: 'nap',
        endedAt: '2026-10-14T01:00:00Z',
      }).success,
    ).toBe(true);
    const active = childRecordSchema.parse({
      ...base,
      service: 'sleep',
      kind: 'night',
    });
    expect(active.endedAt).toBeNull();
  });
  it('rejects a sleep end before its start', () => {
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'sleep',
        kind: 'nap',
        endedAt: '2026-10-13T22:00:00Z',
      }).success,
    ).toBe(false);
  });
  it('keeps unmeasured growth values null and requires at least one measure', () => {
    const measured = childRecordSchema.parse({
      ...base,
      service: 'growth',
      kind: 'measurement',
      weight: '6.25',
    });
    expect(measured.weight).toBe(6.25);
    expect(measured.height).toBeNull();
    expect(measured.head).toBeNull();
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'growth',
        kind: 'measurement',
      }).success,
    ).toBe(false);
  });
  it('requires a title for development diaries and rejects non-positive measurements', () => {
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'growth',
        kind: 'observation',
        title: 'Rolled over',
      }).success,
    ).toBe(true);
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'growth',
        kind: 'observation',
        title: ' ',
      }).success,
    ).toBe(false);
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'growth',
        kind: 'measurement',
        height: '0',
      }).success,
    ).toBe(false);
  });
  it('validates diaper observations and timezone without interpreting them', () => {
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'diaper',
        kind: 'mixed',
        color: 'brown',
        texture: 'soft',
      }).success,
    ).toBe(true);
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'diaper',
        kind: 'dirty',
        color: 'unsupported',
      }).success,
    ).toBe(false);
    expect(
      childRecordSchema.safeParse({
        ...base,
        service: 'diaper',
        kind: 'wet',
        timezone: 'Invalid/Zone',
      }).success,
    ).toBe(false);
  });
  it('accepts raster signatures and rejects SVG, empty and mismatched bytes', () => {
    expect(imageType(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      'image/png',
    );
    expect(imageType(new Uint8Array([255, 216, 255]))).toBe('image/jpeg');
    expect(imageType(new TextEncoder().encode('RIFF1234WEBP'))).toBe(
      'image/webp',
    );
    expect(imageType(new TextEncoder().encode('<svg/>'))).toBeNull();
    expect(imageType(new Uint8Array())).toBeNull();
  });
});
