import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env.local'))
  throw new Error('.env.local already exists; it was not modified.');
const result = spawnSync('npx', ['supabase', 'status', '-o', 'env'], {
  encoding: 'utf8',
});
if (result.status !== 0)
  throw new Error('Start the local Supabase project first.');
const values = Object.fromEntries(
  result.stdout
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [
        line.slice(0, index),
        line.slice(index + 1).replace(/^"|"$/g, ''),
      ];
    }),
);
if (
  values.API_URL !== 'http://127.0.0.1:55321' ||
  !values.ANON_KEY ||
  !values.SERVICE_ROLE_KEY
)
  throw new Error('Unexpected local Supabase configuration.');
writeFileSync(
  '.env.local',
  `NEXT_PUBLIC_SUPABASE_URL=${values.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${values.ANON_KEY}\nNEXT_PUBLIC_SITE_URL=http://127.0.0.1:3187\nNEXT_PUBLIC_AUTH_PROVIDERS=\nSUPABASE_SERVICE_ROLE_KEY=${values.SERVICE_ROLE_KEY}\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Created .env.local for the local podung project. OAuth providers remain disabled until configured.',
);
