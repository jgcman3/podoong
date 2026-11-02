import 'server-only';
import catalogue from '../../../data/facilities/kids-cafes/catalogue.json';
import { coordinates, type Facility } from './public-data';

export function kidsCafeSources(district: string) {
  return catalogue.sources.filter(
    (source) =>
      district === source.region || district.startsWith(source.region + ' '),
  );
}
export function kidsCafeList(district: string, ko: boolean): Facility[] {
  return catalogue.facilities
    .filter((row) => row.address.startsWith(district + ' '))
    .map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      hours: {},
      coordinates: coordinates(row.latitude, row.longitude),
      detail: [
        row.ownership === 'public'
          ? ko
            ? '공공형'
            : 'Public'
          : ko
            ? '민간'
            : 'Private',
        row.ageRange,
        row.freeAdmission === true
          ? ko
            ? '무료'
            : 'Free admission'
          : row.freeAdmission === false
            ? ko
              ? '유료'
              : 'Paid admission'
            : '',
      ]
        .filter(Boolean)
        .join(' · '),
      ...(row.openDays || row.closedDays || row.addressDetail
        ? {
            visiting: {
              addressDetail: row.addressDetail,
              openDays: row.openDays,
              closedDays: row.closedDays,
            },
          }
        : {}),
    }));
}
