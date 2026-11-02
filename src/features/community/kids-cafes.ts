import snapshot from './data/seoul-kids-cafes.json';
import { coordinates, type Facility } from './public-data';

export function kidsCafeList(district: string, ko: boolean): Facility[] {
  return snapshot.facilities
    .filter((row) => row.address.startsWith(district + ' '))
    .map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      hours: {},
      coordinates: coordinates(row.latitude, row.longitude),
      detail: [
        row.ageRange,
        row.freeAdmission
          ? ko
            ? '무료'
            : 'Free admission'
          : ko
            ? '유료'
            : 'Paid admission',
      ]
        .filter(Boolean)
        .join(' · '),
      visiting: {
        addressDetail: row.addressDetail,
        openDays: row.openDays,
        closedDays: row.closedDays,
      },
    }));
}
