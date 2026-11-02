import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hash,
  importSource,
  mergeFacilities,
} from './lib/kids-cafe-import.mjs';

const root = fileURLToPath(
  new URL('../data/facilities/kids-cafes/', import.meta.url),
);
const manifest = JSON.parse(
  await readFile(path.join(root, 'manifest.json'), 'utf8'),
);
if (
  manifest.schemaVersion !== 1 ||
  new Set(manifest.sources.map((row) => row.id)).size !==
    manifest.sources.length
)
  throw new Error('Invalid source manifest');
if (
  process.argv.includes('--check') &&
  process.argv.includes('--update-hashes')
)
  throw new Error('Choose either --check or --update-hashes');
const sources = [],
  facilities = [];
for (const source of manifest.sources) {
  const file = await realpath(path.resolve(root, source.file));
  if (!file.startsWith((await realpath(root)) + path.sep))
    throw new Error('Source must stay inside the data directory');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.sourceDate))
    throw new Error('Missing source date');
  const bytes = await readFile(file);
  if (process.argv.includes('--update-hashes')) source.sha256 = hash(bytes);
  if (bytes.length > 10000000 || hash(bytes) !== source.sha256)
    throw new Error('Source checksum or size mismatch: ' + source.id);
  const result = importSource(source, bytes, manifest.excludedNames);
  sources.push({
    ...source,
    inputRows: result.inputRows,
    rows: result.facilities.length,
    excluded: result.excluded,
    correctedCoordinates: result.correctedCoordinates,
  });
  facilities.push(...result.facilities);
}
const result = {
  schemaVersion: 1,
  sources,
  facilities: mergeFacilities(facilities),
};
const output = JSON.stringify(result, null, 2) + '\n';
const target = path.join(root, 'catalogue.json');
if (process.argv.includes('--check')) {
  if (
    JSON.stringify(JSON.parse(await readFile(target, 'utf8'))) !==
    JSON.stringify(result)
  )
    throw new Error(
      'Run npm run data:kids-cafes and commit the updated catalogue',
    );
} else {
  await writeFile(target, output);
  if (process.argv.includes('--update-hashes'))
    await writeFile(
      path.join(root, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
    );
}
console.log(
  JSON.stringify({
    sources: sources.length,
    facilities: result.facilities.length,
    regions: [
      ...new Set(result.facilities.map((row) => row.address.split(' ')[0])),
    ],
    check: process.argv.includes('--check'),
  }),
);
