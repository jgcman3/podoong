import { expect, it } from 'vitest';
import { availableFacilityKinds } from '@/features/community/facility-availability.server';
import {
  nursingRoomsInArea,
  nursingRooms,
} from '@/features/community/nursing-rooms';
const kinds = (area: string) => availableFacilityKinds(area).map(([id]) => id);

it('shows source-backed categories only where actual facilities exist', () => {
  expect(kinds('서울특별시 용산구')).toContain('kids-cafe');
  expect(kinds('서울특별시 용산구')).toContain('nursing');
  expect(kinds('부산광역시 해운대구')).toContain('kids-cafe');
  expect(kinds('부산광역시 해운대구')).not.toContain('nursing');
  expect(kinds('부산광역시 중구')).not.toContain('kids-cafe');
  expect(kinds('경기도 하남시')).toContain('nursing');
  expect(kinds('경기도 하남시')).not.toContain('kids-cafe');
  for (const area of ['', '경기도 수원시 영통구', '대전광역시 중구']) {
    expect(kinds(area)).not.toContain('nursing');
    expect(kinds(area)).not.toContain('kids-cafe');
    expect(kinds(area)).toEqual([
      'hospital',
      'pharmacy',
      'daycare',
      'kindergarten',
    ]);
  }
});
it('normalizes the supplied Seoul alias without mixing similarly named districts', () => {
  expect(nursingRooms).toHaveLength(86);
  expect(nursingRooms.some((room) => room.address.startsWith('서울시 '))).toBe(
    false,
  );
  expect(nursingRoomsInArea('서울특별시 강동구').length).toBeGreaterThan(4);
  expect(nursingRoomsInArea('부산광역시 강서구')).toEqual([]);
  expect(nursingRoomsInArea('서울특별시 중')).toEqual([]);
  expect(nursingRoomsInArea('')).toEqual([]);
});
