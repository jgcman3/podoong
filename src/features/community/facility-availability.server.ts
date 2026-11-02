import 'server-only';
import { facilityKinds } from './facility-options';
import { kidsCafeList } from './kids-cafes';
import { nursingRoomsInArea } from './nursing-rooms';

export function availableFacilityKinds(area: string) {
  return facilityKinds.filter(([kind]) =>
    kind === 'kids-cafe'
      ? Boolean(area && kidsCafeList(area, true).length)
      : kind === 'nursing'
        ? Boolean(nursingRoomsInArea(area).length)
        : true,
  );
}
