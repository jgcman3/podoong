import data from './korean-regions.json';
// 법정동 codes remain strings: prefixes identify province (2) and district (5).
export const residenceRegions = data.map(([code, fullName]) => {
  const parts = fullName.split(' ');
  return {
    code,
    provinceCode: code.slice(0, 2),
    cityCode: code.slice(0, 5),
    province: parts[0],
    city: parts.slice(1, -1).join(' ') || parts[0],
    locality: parts.at(-1)!,
    fullName,
  };
});
