import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { diaperFacilities } from '@/features/outing/diaper-map.server';
it('keeps confirmed changing tables and only source-matched coordinates', () => {
  expect(diaperFacilities).toHaveLength(9833);
  expect(diaperFacilities.filter((row) => row.coordinates)).toHaveLength(571);
  expect(new Set(diaperFacilities.map((row) => row.id)).size).toBe(
    diaperFacilities.length,
  );
});
it('reproduces outing data from its checked-in original source files', () => {
  expect(() =>
    execFileSync(
      process.execPath,
      ['scripts/build-outing-diaper-map.mjs', '--check'],
      { stdio: 'pipe' },
    ),
  ).not.toThrow();
}, 20000);
