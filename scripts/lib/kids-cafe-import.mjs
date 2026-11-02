import { createHash } from 'node:crypto';

export const clean = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
export const hash = (value) => createHash('sha256').update(value).digest('hex');

export function parseCsv(content) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  const input = content.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && char === ',') {
      row.push(field);
      field = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
      if (char === '\r' && input[i + 1] === '\n') i++;
    } else field += char;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (row.length || field) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift();
  if (!headers?.length || new Set(headers).size !== headers.length)
    throw new Error('Invalid CSV headers');
  return rows.map((values) => {
    if (values.length !== headers.length)
      throw new Error('Invalid CSV column count');
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}
function point(latitude, longitude) {
  if (!clean(latitude) || !clean(longitude)) return null;
  const lat = Number(latitude),
    lon = Number(longitude);
  return Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat > 30 &&
    lat < 45 &&
    lon > 120 &&
    lon < 135
    ? { latitude: lat, longitude: lon }
    : null;
}
export function normalizeAddress(value, region) {
  let address = clean(value)
    .replace(/(^|\s)부산\s/g, '$1부산광역시 ')
    .replace(/(^|\s)서울\s/g, '$1서울특별시 ');
  const tokens = address.split(' ');
  if (tokens.length % 2 === 0) {
    const half = tokens.length / 2;
    if (tokens.slice(0, half).join(' ') === tokens.slice(half).join(' '))
      address = tokens.slice(0, half).join(' ');
  }
  if (
    region.startsWith('부산광역시 ') &&
    address.startsWith('부산광역시 ') &&
    !/^(?:부산광역시) \S+[구군] /.test(address)
  ) {
    address = region + address.slice('부산광역시'.length);
  }
  return address;
}
export function facilityKey(row) {
  const name = row.name
    .replace(/\(주\)|주식회사/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase();
  const address = row.address.replace(/\([^)]*\)/g, '').replace(/\s+/g, '');
  return name + '|' + address;
}
function decodeCsv(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('euc-kr', { fatal: true }).decode(bytes);
  }
}
export function importSource(source, bytes, excludedNames) {
  const rows =
    source.format === 'seoul-public'
      ? JSON.parse(bytes.toString('utf8')).DATA
      : parseCsv(decodeCsv(bytes));
  if (!Array.isArray(rows) || !rows.length)
    throw new Error('Empty source: ' + source.id);
  const result = [],
    excluded = { inactive: 0, unrelated: 0, missingAddress: 0 };
  let correctedCoordinates = 0;
  for (const row of rows) {
    let record;
    if (source.format === 'seoul-public') {
      record = {
        name: clean(row.fclty_nm),
        address: clean(row.bass_adres),
        phone: clean(row.cttpc),
        ownership: 'public',
        ageRange: clean(row.posbl_agrde),
        freeAdmission:
          row.rntfee_free_at === 'Y'
            ? true
            : row.rntfee_free_at === 'N'
              ? false
              : null,
        openDays: clean(row.open_week),
        closedDays: clean(row.close_week),
        addressDetail: clean(row.detail_adres),
        ...point(row.y_crdnt_value, row.x_crdnt_value),
      };
    } else if (source.format === 'busan') {
      const lat = row['위도'],
        lon = row['경도'];
      let location = point(lat, lon);
      if (!location && point(lon, lat)) {
        location = point(lon, lat);
        correctedCoordinates++;
      }
      record = {
        name: clean(
          row['키즈카페명'] || row['업체명'] || row['업소명'] || row['상호'],
        ),
        address: clean(
          row['도로명주소'] || row['소재지(도로명)'] || row['소재지'],
        ),
        phone: clean(row['전화번호'] || row['연락처'] || row['소재지전화']),
        ownership: 'private',
        ...location,
      };
    } else throw new Error('Unsupported source: ' + source.format);
    record.address = normalizeAddress(record.address, source.region);
    if (excludedNames[record.name]) {
      excluded.unrelated++;
      continue;
    }
    if (!record.name || !record.address.startsWith(source.region + ' ')) {
      excluded.missingAddress++;
      continue;
    }
    // Never infer private admission fees, ages or opening hours from a public-café record.
    record = {
      ageRange: '',
      freeAdmission: null,
      openDays: '',
      closedDays: '',
      addressDetail: '',
      latitude: null,
      longitude: null,
      ...record,
      sourceIds: [source.id],
    };
    record.id = record.ownership + '-' + hash(facilityKey(record)).slice(0, 24);
    result.push(record);
  }
  return {
    facilities: result,
    inputRows: rows.length,
    excluded,
    correctedCoordinates,
  };
}
export function mergeFacilities(rows) {
  const unique = new Map();
  for (const row of rows) {
    const key = facilityKey(row),
      previous = unique.get(key);
    if (!previous) unique.set(key, row);
    else {
      unique.set(key, {
        ...previous,
        sourceIds: [...new Set([...previous.sourceIds, ...row.sourceIds])],
        phone: previous.phone || row.phone,
        latitude: previous.latitude ?? row.latitude,
        longitude: previous.longitude ?? row.longitude,
      });
    }
  }
  return [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
}
