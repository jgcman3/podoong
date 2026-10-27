import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const status = spawnSync('npx', ['supabase', 'status', '-o', 'env'], {
  encoding: 'utf8',
});
if (status.status !== 0) throw new Error('Start local Supabase first');
const settings = Object.fromEntries(
  status.stdout.split('\n').flatMap((line) => {
    const match = line.match(/^([A-Z_]+)="(.*)"$/);
    return match ? [[match[1], match[2]]] : [];
  }),
);
if (
  settings.API_URL !== 'http://127.0.0.1:55321' ||
  !settings.ANON_KEY ||
  !settings.SERVICE_ROLE_KEY
)
  throw new Error('Only the local podung project is supported');
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: settings.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: settings.ANON_KEY,
  NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3188',
  NEXT_PUBLIC_AUTH_PROVIDERS: '',
  SUPABASE_SECRET_KEY: '',
  SUPABASE_SERVICE_ROLE_KEY: settings.SERVICE_ROLE_KEY,
  OPERATIONS_SUPABASE_URL: settings.API_URL,
  OPERATIONS_SUPABASE_SECRET_KEY: settings.SERVICE_ROLE_KEY,
};
const worker = process.argv[2] === 'worker';
if (!worker && process.argv[2] && process.argv[2] !== 'e2e')
  throw new Error('Use e2e or worker');
// Next writes this declaration even with a separate distDir. Restore the
// development server's paths after the isolated browser run.
const declaration = worker ? null : readFileSync('next-env.d.ts', 'utf8');
const result = spawnSync(
  worker ? 'node' : 'npx',
  worker
    ? ['scripts/process-operations.mjs']
    : ['playwright', 'test', ...process.argv.slice(3)],
  { env, stdio: 'inherit' },
);
if (declaration !== null) writeFileSync('next-env.d.ts', declaration);
process.exitCode = result.status ?? 1;
