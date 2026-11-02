import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { clean, hash, parseCsv } from './lib/public-data-file.mjs';
const root = new URL('../data/outing/diaper-map/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
function source(file) {
  const entry = manifest.sources.find((s) => s.file === file);
  const bytes = readFileSync(new URL(`sources/${file}`, root));
  if (!entry || hash(bytes) !== entry.sha256)
    throw Error('Diaper map source checksum mismatch');
  return gunzipSync(bytes);
}
for (const entry of manifest.sources) source(entry.file);
const normalize = (s) =>
  clean(s)
    .replace(/^서울시 /, '서울특별시 ')
    .replace(/^강원도 /, '강원특별자치도 ')
    .replace(/^전라북도 /, '전북특별자치도 ');
const key = (name, address) => `${clean(name)}|${normalize(address)}`;
const points = new Map();
for (const row of JSON.parse(
  source('standard-coordinates-2026-11-02.json.gz'),
)) {
  const lat = Number(row.LATITUDE),
    lon = Number(row.LONGITUDE);
  if (!(lat > 30 && lat < 45 && lon > 120 && lon < 135)) continue;
  for (const address of [row.RDNMADR, row.LNMADR].filter(Boolean)) {
    const k = key(row.TOILET_NM, address);
    const previous = points.get(k);
    // Ambiguous same-name/address records are not used for distance calculations.
    if (previous && (previous.lat !== lat || previous.lon !== lon))
      points.set(k, null);
    else if (!points.has(k))
      points.set(k, { lat, lon, date: row.REFERENCE_DATE });
  }
}
const records = [],
  seen = new Set();
for (const row of parseCsv(
  new TextDecoder('utf-8', { fatal: true }).decode(
    source('public-toilets-2026-11-02.utf8.csv.gz'),
  ),
)) {
  if (row['기저귀교환대유무'] !== 'Y') continue;
  const name = clean(row['화장실명']);
  const address = normalize(row['소재지도로명주소'] || row['소재지지번주소']);
  if (!name || !address) continue;
  const id = hash(`${row['개방자치단체코드']}|${row['관리번호']}`).slice(0, 24);
  if (seen.has(id)) throw Error('Duplicate toilet identity');
  seen.add(id);
  const point =
    points.get(key(name, row['소재지도로명주소'])) ||
    points.get(key(name, row['소재지지번주소']));
  records.push({
    id: `toilet-${id}`,
    name,
    address,
    phone: clean(row['전화번호']),
    location: clean(row['기저귀교환대장소']),
    open: clean(row['개방시간상세'] || row['개방시간']),
    sourceDate: row['데이터기준일자'],
    ...(point
      ? {
          coordinates: { lat: point.lat, lon: point.lon },
          coordinateDate: point.date,
        }
      : {}),
  });
}
const output = { retrievedAt: manifest.retrievedAt, records };
const file = new URL('catalogue.json', root);
if (process.argv.includes('--check')) {
  if (JSON.stringify(JSON.parse(readFileSync(file))) !== JSON.stringify(output))
    throw Error('Diaper map catalogue is stale');
} else writeFileSync(file, JSON.stringify(output) + '\n');
console.log(
  `Diaper map: ${records.length} changing facilities, ${records.filter((r) => r.coordinates).length} verified coordinate matches`,
);
