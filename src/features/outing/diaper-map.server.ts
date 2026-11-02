import 'server-only';
import catalogue from '../../../data/outing/diaper-map/catalogue.json';
import type { Facility } from './public-data';

export const diaperFacilities: Facility[] = catalogue.records.map((row) => ({
  id: row.id,
  name: row.name,
  address: row.address,
  phone: row.phone,
  hours: {},
  ...('coordinates' in row ? { coordinates: row.coordinates } : {}),
}));
