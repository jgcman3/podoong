import { spawnSync } from 'node:child_process';
export function localSupabase() {
  const result = spawnSync('npx', ['supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) throw Error('Start local Supabase first.');
  const values = Object.fromEntries(
    result.stdout.split('\n').flatMap((line) => {
      const match = line.match(/^([A-Z_]+)="(.*)"$/);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  if (
    values.API_URL !== 'http://127.0.0.1:55321' ||
    !values.ANON_KEY ||
    !values.SERVICE_ROLE_KEY
  )
    throw Error('Only the local podung DB is allowed.');
  return values;
}
