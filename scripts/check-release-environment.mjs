import { pathToFileURL } from 'node:url';
import { checkEnvironment } from './check-environment.mjs';

export function checkReleaseEnvironment(
  env,
  branch,
  projectRef,
  productionRef,
) {
  const releases = {
    main: { target: 'production', origin: 'https://podoong.com' },
    develop: { target: 'preview', origin: 'https://dev.podoong.com' },
  };
  const release = releases[branch];
  if (!release) throw new Error('Only main and develop can deploy.');
  if (!/^[a-z]{20}$/.test(projectRef ?? ''))
    throw new Error('Set the environment-specific SUPABASE_PROJECT_REF.');
  const result = checkEnvironment(env, release.target, productionRef);
  if (result.databaseHost !== `${projectRef}.supabase.co`)
    throw new Error('App database and migration project must match.');
  if (env.NEXT_PUBLIC_SITE_URL !== release.origin)
    throw new Error('Site URL does not match the release branch.');
  if (!env.SUPABASE_SECRET_KEY && !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Set the server-only Supabase key for this environment.');
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(
      JSON.stringify(
        checkReleaseEnvironment(
          process.env,
          process.env.GITHUB_REF_NAME,
          process.env.SUPABASE_PROJECT_REF,
          process.env.PODUNG_PRODUCTION_PROJECT_REF,
        ),
      ),
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Release check failed.',
    );
    process.exitCode = 1;
  }
}
