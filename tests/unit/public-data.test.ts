import { describe, expect, it } from 'vitest';
import {
  mapLinks,
  medicalFacility,
  kindergartenFacility,
  coordinates,
  nearbyFacilities,
  distanceLabel,
  weekdayHours,
  openingStatus,
  positiveMeasurement,
  readableHours,
  sourceItems,
} from '@/features/community/public-data';
import rooms from '@/features/community/data/nursing-rooms.json';

describe('public facility and measurement data', () => {
  it('orders by coordinates without changing input and keeps unknown locations last', () => {
    const base = {
      name: 'Fixture',
      address: '서울특별시 강남구',
      phone: '',
      hours: {},
    };
    const rows = [
      { ...base, id: 'far', coordinates: { lat: 37.6, lon: 127.1 } },
      { ...base, id: 'unknown' },
      { ...base, id: 'near', coordinates: { lat: 37.5, lon: 127.0001 } },
    ];
    const sorted = nearbyFacilities(rows, { lat: 37.5, lon: 127 });
    expect(sorted.map((row) => row.id)).toEqual(['near', 'far', 'unknown']);
    expect(rows.map((row) => row.id)).toEqual(['far', 'unknown', 'near']);
    expect(distanceLabel(sorted[0].distanceKm!, true)).toContain('100m 이내');
    expect(coordinates('127', '37')).toBeUndefined();
    expect(coordinates('', '')).toBeUndefined();
  });
  it('searches by facility name and a short neighborhood or district, without street details', () => {
    const links = mapLinks({
      name: '테스트 약국',
      address: '서울특별시 강남구 테헤란로 123, 3층 (역삼동, 긴 빌딩 이름)',
    });
    expect(decodeURIComponent(new URL(links.naver).pathname)).toBe(
      '/p/search/테스트 약국 역삼동',
    );
    expect(
      decodeURIComponent(
        new URL(
          mapLinks({
            name: '테스트 의원',
            address: '경기도 성남시 분당구 테스트로 123',
          }).kakao,
        ).pathname,
      ),
    ).toBe('/link/search/테스트 의원 분당구');
    expect(weekdayHours({ dutyTime1s: '0900', dutyTime1c: '1800' }, 1)).toBe(
      '09:00–18:00',
    );
    expect(weekdayHours({}, 7)).toBe('');
    expect(
      openingStatus(
        { dutyTime1s: '0900', dutyTime1c: '1800' },
        false,
        new Date('2026-11-02T00:00:00+09:00'),
      ),
    ).toBe('before');
  });
  it('does not return the kindergarten API echoed key or staff personal names', () => {
    const facility = kindergartenFacility({
      key: 'synthetic-secret',
      kindercode: 'fixture',
      kindername: 'Fixture kindergarten',
      rppnname: 'private representative',
      ldgrname: 'private principal',
      addr: '서울특별시 강남구',
      telno: '02-000-0000',
    });
    expect(JSON.stringify(facility)).not.toContain('synthetic-secret');
    expect(JSON.stringify(facility)).not.toContain('private');
  });
  it('rejects an API error even when HTTP succeeded, and normalizes single and empty items', () => {
    expect(() =>
      sourceItems({ response: { header: { resultCode: '30' } } }),
    ).toThrow('public-source-unavailable');
    expect(
      sourceItems({
        response: {
          header: { resultCode: '00' },
          body: { totalCount: 1, items: { item: { hpid: 'fixture' } } },
        },
      }).rows,
    ).toHaveLength(1);
    expect(
      sourceItems({
        response: {
          header: { resultCode: '00' },
          body: { totalCount: 0, items: '' },
        },
      }).rows,
    ).toEqual([]);
    expect(() =>
      sourceItems({
        response: {
          header: { resultCode: '00' },
          body: { totalCount: 'not a number' },
        },
      }),
    ).toThrow('invalid-public-source');
  });
  it('uses Korean local time, holiday hours, and an exclusive closing boundary', () => {
    expect(weekdayHours({ dutyTime1s: '0', dutyTime1c: '2400' }, 1)).toBe(
      '00:00–24:00',
    );
    const hours = {
      dutyTime1s: '0900',
      dutyTime1c: '1800',
      dutyTime8s: '1000',
      dutyTime8c: '1300',
    };
    expect(openingStatus(hours, false, new Date('2026-11-02T00:00:00Z'))).toBe(
      'open',
    );
    expect(openingStatus(hours, false, new Date('2026-11-02T09:00:00Z'))).toBe(
      'closed',
    );
    expect(openingStatus(hours, true, new Date('2026-11-02T04:00:00Z'))).toBe(
      'closed',
    );
    expect(readableHours(hours, true, new Date('2026-11-02T00:00:00Z'))).toBe(
      '10:00–13:00',
    );
    expect(openingStatus(hours, false, new Date('2026-11-01T14:59:00Z'))).toBe(
      'unknown',
    );
  });
  it('never treats missing holiday data, incomplete hours, invalid or overnight hours as confirmed open/closed', () => {
    const now = new Date('2026-11-02T01:00:00Z');
    expect(
      openingStatus({ dutyTime1s: '0900', dutyTime1c: '1800' }, null, now),
    ).toBe('unknown');
    expect(
      openingStatus({ dutyTime1s: '0900', dutyTime1c: '1800' }, true, now),
    ).toBe('unknown');
    const samples: Record<string, string>[] = [
      {},
      { dutyTime1s: '0900' },
      { dutyTime1s: '1900', dutyTime1c: '0700' },
      { dutyTime1s: '0900', dutyTime1c: '2899' },
    ];
    for (const hours of samples)
      expect(openingStatus(hours, false, now)).toBe('unknown');
  });
  it('keeps only needed public facility fields and escapes map search text', () => {
    const facility = medicalFacility({
      hpid: 'fixture',
      dutyName: '테스트 & 의원',
      dutyAddr: '서울특별시 중구',
      dutyTime1s: 900,
      dutyTime1c: '1800',
      unused: 'discarded',
    });
    expect(facility.hours.dutyTime1s).toBe('900');
    expect(facility).not.toHaveProperty('unused');
    const link = new URL(mapLinks(facility).kakao);
    expect(link.hostname).toBe('map.kakao.com');
    expect(link.search).toBe('');
    expect(decodeURIComponent(link.pathname)).toContain('테스트 & 의원 중구');
  });
  it('preserves absent/invalid measurements rather than inventing zero', () => {
    for (const value of ['', ' ', '-', undefined, null, '-1', 'NaN'])
      expect(positiveMeasurement(value)).toBeNull();
    expect(positiveMeasurement('0')).toBe(0);
    expect(positiveMeasurement('17')).toBe(17);
  });
  it('imports the supplied metro snapshot without invented location or opening data', () => {
    expect(rooms.sourceDate).toBe('2025-09-24');
    expect(rooms.rooms).toHaveLength(86);
    expect(new Set(rooms.rooms.map((row) => row.id)).size).toBe(86);
    expect(
      rooms.rooms.every(
        (row) =>
          row.name && row.address && typeof row.diaperTable === 'boolean',
      ),
    ).toBe(true);
    expect(rooms.rooms[0]).not.toHaveProperty('hours');
  });
});
