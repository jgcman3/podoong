import 'server-only';
import { facilityKinds } from './facility-options';
import { kidsCafeList } from './kids-cafes';
import { diaperFacilitiesInArea } from './diaper-map.server';

export function availableFacilityKinds(area: string) {
  return facilityKinds.filter(([kind]) =>
    kind === 'kids-cafe'
      ? Boolean(area && kidsCafeList(area, true).length)
      : kind === 'nursing'
        ? Boolean(diaperFacilitiesInArea(area).length)
        : true,
  );
}
