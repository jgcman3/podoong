import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

export function checkEnvironment(env, target, productionRef) {
  if (!['development', 'preview', 'production'].includes(target))
    throw new Error('Choose --target development, preview or production.');
  if (!/^[a-z]{20}$/.test(productionRef ?? ''))
    throw new Error('Set PODUNG_PRODUCTION_PROJECT_REF or --production-ref.');
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('NEXT_PUBLIC_') || !value) continue;
    let privileged = value.startsWith('sb_secret_');
    try {
      privileged ||=
        JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString())
          .role === 'service_role';
    } catch {
      /* Opaque public keys are not JWTs. */
    }
    if (privileged || /SECRET|SERVICE_ROLE|PASSWORD|PRIVATE_KEY/.test(name))
      throw new Error(
        `Remove privileged credential from public variable ${name}.`,
      );
  }
  let database, site;
  try {
    database = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    site = new URL(env.NEXT_PUBLIC_SITE_URL);
  } catch {
    throw new Error(
      'Set valid NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SITE_URL.',
    );
  }
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    throw new Error('Set the public Supabase key for this environment.');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname);
  const production = database.hostname === `${productionRef}.supabase.co`;
  if (target !== 'production' && production)
    throw new Error(
      'Development/preview must not connect to the production database.',
    );
  if (target === 'production' && !production)
    throw new Error(
      'Production must connect to the expected production project.',
    );
  if (
    !local &&
    (database.protocol !== 'https:' ||
      !/^[a-z]{20}\.supabase\.co$/.test(database.hostname))
  )
    throw new Error(
      'Use a local Supabase URL or an HTTPS Supabase project URL.',
    );
  if (target !== 'development') {
    const hostname = site.hostname;
    if (
      local ||
      site.protocol !== 'https:' ||
      ['localhost', '[::1]'].includes(hostname) ||
      /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
    )
      throw new Error(
        'Preview/production require a separate remote database and public HTTPS site URL.',
      );
  }
  if (env.VERCEL_ENV && env.VERCEL_ENV !== target)
    throw new Error('Deployment target does not match VERCEL_ENV.');
  return { target, databaseHost: database.host, siteOrigin: site.origin };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { values } = parseArgs({
      options: {
        target: { type: 'string' },
        'production-ref': { type: 'string' },
      },
    });
    console.log(
      JSON.stringify(
        checkEnvironment(
          process.env,
          values.target,
          values['production-ref'] ?? process.env.PODUNG_PRODUCTION_PROJECT_REF,
        ),
      ),
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Environment check failed.',
    );
    process.exitCode = 1;
  }
}
