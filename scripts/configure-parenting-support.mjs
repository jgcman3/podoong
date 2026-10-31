import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const ref = process.argv[process.argv.indexOf('--project-ref') + 1];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const key = process.env.GOV24_SERVICE_KEY;
if (
  !/^[a-z0-9]{20}$/.test(ref ?? '') ||
  url !== `https://${ref}.supabase.co` ||
  !secret ||
  !key ||
  /[\r\n]/.test(key)
)
  throw new Error(
    'Check the explicit project ref, app environment and GOV24_SERVICE_KEY.',
  );
const token = randomBytes(32).toString('hex');
const directory = await mkdtemp(join(tmpdir(), 'podoong-support-'));
try {
  const path = join(directory, 'worker.env');
  await writeFile(
    path,
    `GOV24_SERVICE_KEY=${key}\nSUPPORT_WORKER_TOKEN=${token}\n`,
    { mode: 0o600 },
  );
  const result = spawnSync(
    'npx',
    ['supabase', 'secrets', 'set', '--project-ref', ref, '--env-file', path],
    { encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(
      'Could not configure Supabase secrets. Check CLI authentication and project access.',
    );
  const worker = `${url}/functions/v1/parenting-support`;
  const response = await fetch(worker, {
    method: 'POST',
    headers: { 'x-podoong-support-token': token },
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw new Error(
      'First collection did not succeed. The daily schedule was not enabled. Check API approval and the deployed worker.',
    );
  const count = await response.json();
  const db = createClient(url, secret, { auth: { persistSession: false } });
  const configured = await db.rpc('configure_parenting_support', {
    p_worker_url: worker,
    p_token: token,
  });
  if (configured.error)
    throw new Error(
      'Collection succeeded, but the schedule could not be configured.',
    );
  console.log(
    `Support collection ready for ${ref}: ${Number(count.collected)} services; daily at 03:20 KST.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
