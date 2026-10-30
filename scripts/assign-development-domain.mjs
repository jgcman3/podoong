import { pathToFileURL } from 'node:url';

export async function assignDevelopmentDomain(
  env,
  deploymentUrl,
  request = fetch,
) {
  if (env.GITHUB_REF_NAME !== 'develop')
    throw new Error('Only develop can assign the development domain.');
  for (const name of ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'])
    if (!env[name]) throw new Error(`Missing deployment setting: ${name}`);
  const url = new URL(deploymentUrl.trim());
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.vercel.app') ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Expected an HTTPS Vercel deployment URL.');
  const query = `teamId=${encodeURIComponent(env.VERCEL_ORG_ID)}`;
  const headers = { Authorization: `Bearer ${env.VERCEL_TOKEN}` };
  const info = await request(
    `https://api.vercel.com/v13/deployments/${encodeURIComponent(url.hostname)}?${query}`,
    {
      headers,
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!info.ok)
    throw new Error(`Deployment lookup failed (HTTP ${info.status}).`);
  const deployment = await info.json();
  if (
    deployment.projectId !== env.VERCEL_PROJECT_ID ||
    deployment.readyState !== 'READY' ||
    deployment.target === 'production' ||
    deployment.meta?.githubCommitRef !== 'develop' ||
    !/^dpl_[A-Za-z0-9]+$/.test(deployment.id)
  )
    throw new Error(
      'Expected a ready development deployment in the configured project.',
    );
  const result = await request(
    `https://api.vercel.com/v2/deployments/${deployment.id}/aliases?${query}`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ alias: 'dev.podoong.com' }),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!result.ok)
    throw new Error(
      `Development domain assignment failed (HTTP ${result.status}).`,
    );
  return { alias: 'dev.podoong.com', deploymentId: deployment.id };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(
      JSON.stringify(
        await assignDevelopmentDomain(process.env, process.argv[2] ?? ''),
      ),
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : 'Development domain assignment failed.',
    );
    process.exitCode = 1;
  }
}
