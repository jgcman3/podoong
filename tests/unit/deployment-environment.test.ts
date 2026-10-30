import { expect, test } from 'vitest';
import { checkEnvironment } from '../../scripts/check-environment.mjs';
const productionRef = 'aaaaaaaaaaaaaaaaaaaa';
const env = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
  NEXT_PUBLIC_SITE_URL: 'https://podung.example',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-fixture-key',
};
test('development and preview cannot target the production database', () => {
  for (const target of ['development', 'preview'])
    expect(() => checkEnvironment(env, target, productionRef)).toThrow(
      'must not connect',
    );
  expect(
    checkEnvironment(
      { ...env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55321' },
      'development',
      productionRef,
    ).target,
  ).toBe('development');
});
test('production validates project, public HTTPS and host environment', () => {
  expect(checkEnvironment(env, 'production', productionRef).target).toBe(
    'production',
  );
  expect(() =>
    checkEnvironment(
      { ...env, NEXT_PUBLIC_SITE_URL: 'http://192.168.45.85:3187' },
      'production',
      productionRef,
    ),
  ).toThrow('HTTPS');
  expect(() =>
    checkEnvironment(
      { ...env, VERCEL_ENV: 'preview' },
      'production',
      productionRef,
    ),
  ).toThrow('VERCEL_ENV');
  expect(() =>
    checkEnvironment(
      {
        ...env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://bbbbbbbbbbbbbbbbbbbb.supabase.co',
      },
      'production',
      productionRef,
    ),
  ).toThrow('expected production');
});
test('public environment variables cannot expose privileged keys', () => {
  const jwt = `fixture.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.fixture`;
  for (const key of ['sb_secret_fixture', jwt])
    expect(() =>
      checkEnvironment(
        { ...env, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key },
        'production',
        productionRef,
      ),
    ).toThrow('privileged');
  expect(() =>
    checkEnvironment(
      { ...env, NEXT_PUBLIC_SERVICE_ROLE_KEY: 'fixture' },
      'production',
      productionRef,
    ),
  ).toThrow('privileged');
});

test('release branch binds the app, domain and migration database together', async () => {
  const { checkReleaseEnvironment } =
    await import('../../scripts/check-release-environment.mjs');
  const production = {
    ...env,
    NEXT_PUBLIC_SITE_URL: 'https://podoong.com',
    SUPABASE_SECRET_KEY: 'sb_secret_server_fixture',
    VERCEL_ENV: 'production',
  };
  const developmentRef = 'bbbbbbbbbbbbbbbbbbbb';
  const development = {
    ...production,
    NEXT_PUBLIC_SUPABASE_URL: `https://${developmentRef}.supabase.co`,
    NEXT_PUBLIC_SITE_URL: 'https://dev.podoong.com',
    VERCEL_ENV: 'preview',
  };
  expect(
    checkReleaseEnvironment(production, 'main', productionRef, productionRef)
      .target,
  ).toBe('production');
  expect(
    checkReleaseEnvironment(
      development,
      'develop',
      developmentRef,
      productionRef,
    ).target,
  ).toBe('preview');
  expect(() =>
    checkReleaseEnvironment(
      production,
      'develop',
      productionRef,
      productionRef,
    ),
  ).toThrow();
  expect(() =>
    checkReleaseEnvironment(development, 'main', developmentRef, productionRef),
  ).toThrow();
  expect(() =>
    checkReleaseEnvironment(
      development,
      'develop',
      'cccccccccccccccccccc',
      productionRef,
    ),
  ).toThrow('must match');
  expect(() =>
    checkReleaseEnvironment(
      { ...development, NEXT_PUBLIC_SITE_URL: 'https://podoong.com' },
      'develop',
      developmentRef,
      productionRef,
    ),
  ).toThrow('Site URL');
  expect(() =>
    checkReleaseEnvironment(
      { ...development, SUPABASE_SECRET_KEY: '' },
      'develop',
      developmentRef,
      productionRef,
    ),
  ).toThrow('server-only');
  expect(() =>
    checkReleaseEnvironment(
      development,
      'feature/fixture',
      developmentRef,
      productionRef,
    ),
  ).toThrow('Only main');
});
