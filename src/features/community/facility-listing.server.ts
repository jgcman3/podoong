import 'server-only';
import type { Locale } from '@/lib/domain';
import type { Facility } from './public-data';
import type { FacilityKind } from './facility-options';
import { nearbyFacilities } from './public-data';
import {
  medicalResults,
  kindergartenList,
  facilityOrigin,
} from './public-data.server';
import { kidsCafeList } from './kids-cafes';
import { diaperFacilitiesInArea } from './diaper-map.server';
import { childcareList } from './childcare.server';

export async function loadFacilityRows({
  kind,
  area,
  referenceArea,
  locale,
  page = 1,
  query = {},
}: {
  kind: FacilityKind;
  area: string;
  referenceArea?: string;
  locale: Locale;
  page?: number;
  query?: { open?: string; diaper?: string; specialty?: string };
}) {
  let rows: Facility[] = [],
    total = 0,
    holiday: boolean | null = null,
    unavailable = false,
    checkedAt = '';
  const ko = locale === 'ko';
  const medical = kind === 'hospital' || kind === 'pharmacy';
  const origin = area ? await facilityOrigin(referenceArea || area) : undefined;
  if (kind === 'nursing') {
    const facilities = nearbyFacilities(
      diaperFacilitiesInArea(area),
      origin?.coordinates,
    );
    total = facilities.length;
    rows = facilities.slice((page - 1) * 10, page * 10);
  } else if (medical && area) {
    try {
      const result = await medicalResults(kind, area, page, {
        origin: origin?.coordinates,
        openOnly: query.open !== '0',
        specialty: query.specialty === 'all' ? 'all' : 'pediatrics',
      });
      rows = result.facilities;
      total = result.total;
      holiday = result.holiday;
      checkedAt = result.checkedAt;
    } catch {
      unavailable = true;
    }
  } else if (kind === 'kids-cafe' && area) {
    const facilities = nearbyFacilities(
      kidsCafeList(area, ko),
      origin?.coordinates,
    );
    total = facilities.length;
    rows = facilities.slice((page - 1) * 10, page * 10);
  } else if ((kind === 'kindergarten' || kind === 'daycare') && area) {
    try {
      const result = await (kind === 'daycare'
        ? childcareList(area)
        : kindergartenList(area));
      const ranked = nearbyFacilities(result.facilities, origin?.coordinates);
      total = ranked.length;
      rows = ranked.slice((page - 1) * 10, page * 10);
      checkedAt = result.checkedAt;
    } catch {
      unavailable = true;
    }
  }

  return {
    facilities: rows,
    total,
    holiday,
    unavailable,
    checkedAt,
    asOf: new Date().toISOString(),
  };
}
