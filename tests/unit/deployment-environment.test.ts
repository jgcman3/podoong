import { expect, test } from 'vitest';
import { checkEnvironment } from '../../scripts/check-environment.mjs';
import { assignDevelopmentDomain } from '../../scripts/assign-development-domain.mjs';
const productionRef = 'aaaaaaaaaaaaaaaaaaaa';
const env = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${productionRef}.supabase.co`,
  NEXT_PUBLIC_SITE_URL: 'https://podung.example',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'public-fixture-key',
};
test('development alias uses the team API without looking up a user', async () => {
  const calls: Array<{ url: string; options: RequestInit }> = [];
  const deployment = {
    id: 'dpl_fixture',
    projectId: 'prj_fixture',
    readyState: 'READY',
    target: null,
    meta: { githubCommitRef: 'develop' },
  };
  const request: typeof fetch = async (input, options) => {
    calls.push({ url: String(input), options: options ?? {} });
    return new Response(
      JSON.stringify(
        calls.length === 1 ? deployment : { alias: 'dev.podoong.com' },
      ),
    );
  };
  await expect(
    assignDevelopmentDomain(
      {
        GITHUB_REF_NAME: 'develop',
        VERCEL_TOKEN: 'fixture',
        VERCEL_ORG_ID: 'team_fixture',
        VERCEL_PROJECT_ID: 'prj_fixture',
      },
      'https://fixture.vercel.app',
      request,
    ),
  ).resolves.toEqual({ alias: 'dev.podoong.com', deploymentId: 'dpl_fixture' });
  expect(calls.map((call) => call.url)).toEqual([
    'https://api.vercel.com/v13/deployments/fixture.vercel.app?teamId=team_fixture',
    'https://api.vercel.com/v2/deployments/dpl_fixture/aliases?teamId=team_fixture',
  ]);
  expect(calls[1].options.method).toBe('POST');
  expect(JSON.parse(calls[1].options.body as string)).toEqual({
    alias: 'dev.podoong.com',
  });
});
test('development alias rejects a different branch, project or production deployment', async () => {
  const settings = {
    GITHUB_REF_NAME: 'develop',
    VERCEL_TOKEN: 'fixture',
    VERCEL_ORG_ID: 'team_fixture',
    VERCEL_PROJECT_ID: 'prj_fixture',
  };
  const deployment = {
    id: 'dpl_fixture',
    projectId: 'prj_fixture',
    readyState: 'READY',
    target: null,
    meta: { githubCommitRef: 'develop' },
  };
  for (const mismatch of [
    { projectId: 'prj_other' },
    { target: 'production' },
    { meta: { githubCommitRef: 'main' } },
    { readyState: 'ERROR' },
  ]) {
    let calls = 0;
    const request = async () => {
      calls++;
      return new Response(JSON.stringify({ ...deployment, ...mismatch }));
    };
    await expect(
      assignDevelopmentDomain(settings, 'https://fixture.vercel.app', request),
    ).rejects.toThrow('ready development deployment');
    expect(calls).toBe(1);
  }
  await expect(
    assignDevelopmentDomain(
      { ...settings, GITHUB_REF_NAME: 'main' },
      'https://fixture.vercel.app',
    ),
  ).rejects.toThrow('Only develop');
  await expect(
    assignDevelopmentDomain(settings, 'https://example.com'),
  ).rejects.toThrow('Vercel deployment URL');
});
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
