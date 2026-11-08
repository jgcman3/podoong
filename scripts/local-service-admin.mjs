import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export const DEVELOPMENT_PROJECT_REF = 'aacmsohijybjiyidfzgy';
const bindingPath = '.secrets/local-service-admin.json';

/**
 * @param {string | undefined} url
 * @param {string} ref
 * @param {{ NODE_ENV?: string, CI?: string, VERCEL?: string }} [environment]
 */
export function validateLocalAdminTarget(url, ref, environment = process.env) {
  if (
    environment.NODE_ENV === 'production' ||
    environment.CI ||
    environment.VERCEL
  )
    throw Error('This command is for local development only.');
  if (
    url !== `https://${DEVELOPMENT_PROJECT_REF}.supabase.co` ||
    ref !== DEVELOPMENT_PROJECT_REF
  )
    throw Error(
      'Only the designated development database is allowed. Production is never a target.',
    );
}

export function kakaoSubject(user) {
  const identity = user.identities?.find((entry) => entry.provider === 'kakao');
  const subject = identity?.identity_data?.sub;
  // Provider identities are trusted; editable profile names and user metadata are not.
  return typeof subject === 'string' && subject.trim() ? subject : null;
}

export function validateAdminBinding(binding) {
  if (
    binding?.version !== 1 ||
    binding.projectRef !== DEVELOPMENT_PROJECT_REF ||
    binding.provider !== 'kakao' ||
    typeof binding.subject !== 'string' ||
    !binding.subject.trim()
  )
    throw Error(
      'Invalid local administrator binding. Bind the verified Kakao account again.',
    );
  return binding;
}

async function main() {
  const args = process.argv.slice(2);
  const bind =
    args.length === 2 &&
    args[0] === '--bind-user' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      args[1],
    );
  if (args.length && !bind)
    throw Error('Usage: npm run admin:local [-- --bind-user <user UUID>]');
  const config = JSON.parse(
    readFileSync('.secrets/development-supabase.json', 'utf8'),
  );
  const line = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((value) => value.startsWith('NEXT_PUBLIC_SUPABASE_URL='));
  const url = line
    ?.slice('NEXT_PUBLIC_SUPABASE_URL='.length)
    .trim()
    .replace(/^['"]|['"]$/g, '');
  validateLocalAdminTarget(url, config.ref);
  const db = createClient(url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let binding;
  let user;
  if (bind) {
    const result = await db.auth.admin.getUserById(args[1]);
    if (result.error || !result.data.user)
      throw Error('The specified development account was not found.');
    user = result.data.user;
    const subject = kakaoSubject(user);
    if (!subject)
      throw Error('The account must have a verified Kakao provider identity.');
    binding = {
      version: 1,
      projectRef: DEVELOPMENT_PROJECT_REF,
      provider: 'kakao',
      subject,
    };
  } else {
    try {
      binding = validateAdminBinding(
        JSON.parse(readFileSync(bindingPath, 'utf8')),
      );
    } catch {
      throw Error(
        'First bind the verified account: npm run admin:local -- --bind-user <user UUID>',
      );
    }
    const matches = [];
    for (let page = 1; ; page++) {
      const result = await db.auth.admin.listUsers({ page, perPage: 100 });
      if (result.error) throw Error('Development account lookup failed.');
      for (const candidate of result.data.users) {
        if (!(candidate.app_metadata?.providers ?? []).includes('kakao'))
          continue;
        const detail = await db.auth.admin.getUserById(candidate.id);
        if (detail.error || !detail.data.user)
          throw Error('Provider identity lookup failed.');
        if (kakaoSubject(detail.data.user) === binding.subject)
          matches.push(detail.data.user);
      }
      if (result.data.users.length < 100) break;
    }
    if (matches.length !== 1)
      throw Error(
        'Sign in with the bound Kakao account, finish signup, then run this command again.',
      );
    user = matches[0];
  }
  const profile = await db
    .from('profiles')
    .select('consented_at')
    .eq('id', user.id)
    .maybeSingle();
  if (profile.error || !profile.data?.consented_at)
    throw Error('Complete signup before restoring administrator access.');
  const active = await db
    .from('data_operation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (active.error || active.count)
    throw Error('Account deletion must finish before access can be restored.');
  const grant = await db
    .from('service_admins')
    .upsert({ user_id: user.id, role: 'owner' }, { onConflict: 'user_id' });
  if (grant.error) throw Error('Administrator access could not be restored.');
  if (bind) {
    mkdirSync('.secrets', { recursive: true });
    writeFileSync(bindingPath, JSON.stringify(binding, null, 2) + '\n', {
      mode: 0o600,
    });
  }
  console.log(`Development administrator ready: ${user.id}`);
  console.log(
    'Local and dev share this development database. Production was not changed.',
  );
  console.log(
    'After deleting and signing up again with the same Kakao account: npm run admin:local',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
