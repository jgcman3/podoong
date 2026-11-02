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
