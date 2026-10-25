import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const container = 'supabase_db_podung';
const database = `podung_restore_${randomBytes(8).toString('hex')}`;
function docker(args, input) {
  const r = spawnSync('docker', ['exec', '-i', container, ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    const category = /already exists/.test(r.stderr)
      ? 'duplicate schema'
      : /does not exist/.test(r.stderr)
        ? 'missing dependency'
        : 'database command failed';
    throw new Error(category);
  }
  return r.stdout;
}
const tables = [
  'profiles',
  'families',
  'residence_regions',
  'residence_countries',
  'children',
  'child_meal_plans',
  'care_records',
  'child_records',
  'child_record_photos',
  'child_photo_cleanup',
  'vaccination_records',
  'tasks',
  'events',
  'community_posts',
  'community_boards',
  'notifications',
  'daily_polls',
  'data_operation_jobs',
];
const counts = () =>
  tables
    .map((t) => `select '${t}',count(*) from public.${t}`)
    .join(' union all ') +
  " union all select 'auth.users',count(*) from auth.users union all select 'storage.objects',count(*) from storage.objects";
let created = false;
try {
  const identity = docker([
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-Atc',
    'select current_database()',
  ]);
  if (identity.trim() !== 'postgres')
    throw new Error('Unexpected local database');
  const dump = docker([
    'pg_dump',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '--no-owner',
    '--no-acl',
    '--schema=public',
    '--schema=auth',
    '--schema=storage',
    '--schema=extensions',
  ]);
  const original = docker([
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-Atc',
    counts(),
  ]);
  const schemaQuery =
    "select count(*) from pg_policies where schemaname='public'; select count(*) from information_schema.routines where routine_schema='public'; select count(*) from information_schema.table_constraints where constraint_schema='public';";
  const originalSchema = docker([
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-Atc',
    schemaQuery,
  ]);
  docker(['createdb', '-U', 'postgres', database]);
  created = true;
  // Supabase installs pgcrypto in extensions; extension restoration may be absent
  // in a schema-filtered dump, so initialize it in the isolated database first.
  docker([
    'psql',
    '-U',
    'postgres',
    '-d',
    database,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists btree_gist with schema extensions;',
  ]);
  docker(
    ['psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'],
    dump.replace(
      /CREATE SCHEMA (public|auth|storage|extensions);/g,
      'CREATE SCHEMA IF NOT EXISTS $1;',
    ),
  );
  const restored = docker([
    'psql',
    '-U',
    'postgres',
    '-d',
    database,
    '-Atc',
    counts(),
  ]);
  if (restored !== original) throw new Error('Restored counts differ');
  const policies = docker([
    'psql',
    '-U',
    'postgres',
    '-d',
    database,
    '-Atc',
    schemaQuery,
  ]);
  if (policies !== originalSchema)
    throw new Error('Restored schema checks differ');
  console.log(
    JSON.stringify({
      restore: 'passed',
      criticalTables: tables.length + 2,
      schemaChecks: policies.trim().split('\n').map(Number),
    }),
  );
} catch (error) {
  console.error(`Local restore verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      docker(['dropdb', '-U', 'postgres', database]);
    } catch {
      console.error('Temporary database cleanup failed');
      process.exitCode = 1;
    }
  }
}
