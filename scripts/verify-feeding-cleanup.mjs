import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const container = 'supabase_db_podung';
const port = spawnSync('docker', ['port', container, '5432/tcp'], {
  encoding: 'utf8',
});
const identity = spawnSync(
  'docker',
  [
    'inspect',
    '-f',
    '{{index .Config.Labels "com.supabase.cli.project"}}',
    container,
  ],
  { encoding: 'utf8' },
);
if (
  port.status !== 0 ||
  identity.stdout.trim() !== 'podung' ||
  !port.stdout
    .split('\n')
    .some((line) =>
      /^(127\.0\.0\.1|0\.0\.0\.0|\[::\]):55322$/.test(line.trim()),
    )
)
  throw new Error('Only the local podung database is supported');
const migration = readFileSync(
  new URL(
    '../supabase/migrations/202610140011_remove_deprecated_feeding.sql',
    import.meta.url,
  ),
  'utf8',
);
const fixture = readFileSync(
  new URL('./fixtures/remove-deprecated-feeding.sql', import.meta.url),
  'utf8',
);
const input = fixture.replace(
  '\\ir ../migrations/202610140011_remove_deprecated_feeding.sql',
  () => migration,
);
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-At',
  ],
  { input, encoding: 'utf8' },
);
// The fixture encloses the actual migration in BEGIN/ROLLBACK; closing a failed
// connection also rolls back, so verification never commits a cleanup.
if (
  result.status !== 0 ||
  /^not ok/m.test(result.stdout) ||
  !result.stdout.includes('1..10')
)
  throw new Error('Feeding cleanup migration verification failed');
console.log('Feeding cleanup: 10 checks passed; transaction rolled back');
