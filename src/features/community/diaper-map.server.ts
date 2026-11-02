import 'server-only';
import catalogue from '../../../data/facilities/diaper-map/catalogue.json';
import type { Facility } from './public-data';

export const diaperFacilities: Facility[] = catalogue.records.map((row) => ({
  id: row.id,
  name: row.name,
  address: row.address,
  phone: row.phone,
  hours: {},
  diaperTable: true,
  ...('coordinates' in row ? { coordinates: row.coordinates } : {}),
  detail: [row.location, row.open, row.sourceDate].filter(Boolean).join(' · '),
}));
export function diaperFacilitiesInArea(area: string) {
  return area
    ? diaperFacilities.filter((row) => row.address.startsWith(area + ' '))
    : [];
}
