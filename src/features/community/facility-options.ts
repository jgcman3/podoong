export const facilityKinds = [
  ['hospital', '병원', 'Hospitals'],
  ['pharmacy', '약국', 'Pharmacies'],
  ['daycare', '어린이집', 'Daycare'],
  ['kindergarten', '유치원', 'Kindergartens'],
  ['playground', '놀이터·놀이시설', 'Playgrounds'],
  ['nursing', '수유실·기저귀 교환대', 'Nursing & changing'],
] as const;
export type FacilityKind = (typeof facilityKinds)[number][0];
