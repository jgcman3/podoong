// Input: UTF-8 conversion of code.go.kr's CP949 법정동코드 전체자료.txt.
// Generate a NEW migration for later snapshots; never rewrite an applied migration.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const input = process.argv[2];
const retrieved = process.argv[3];
if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(retrieved ?? ''))
  throw new Error(
    'Usage: node scripts/import-korean-regions.mjs <utf8-source.txt> <YYYY-MM-DD>',
  );
const source = readFileSync(input, 'utf8');
const rows = source
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split('\t').map((value) => value.trim()));
const localities = rows.filter(
  ([code, , status]) =>
    status === '존재' &&
    /^\d{10}$/.test(code) &&
    code.endsWith('00') &&
    !code.endsWith('00000'),
);
if (
  localities.length < 4000 ||
  new Set(localities.map((r) => r[0])).size !== localities.length
)
  throw new Error('Unexpected locality snapshot');
writeFileSync(
  'src/features/family/korean-regions.json',
  JSON.stringify(localities.map(([code, name]) => [code, name])) + '\n',
);
writeFileSync(
  'docs/implementation/korean-regions-source.json',
  JSON.stringify(
    {
      source: 'https://www.code.go.kr/stdcode/regCodeL.do',
      download:
        'POST https://www.code.go.kr/etc/codeFullDown.do; codeseId=법정동코드',
      retrieved,
      utf8Sha256: createHash('sha256').update(source).digest('hex'),
      localities: localities.length,
      selection:
        '존재, 10-digit code ends in 00 but not 00000; 읍·면·동, excluding 리',
    },
    null,
    2,
  ) + '\n',
);
console.log(`Generated ${localities.length} localities`);
