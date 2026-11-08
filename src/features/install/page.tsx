import { appleStartupImages } from '@/lib/app-startup.mjs';
import { appName, appManifestPath } from './manifest';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loadFamily, requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { Shell } from '@/components/shell';
import { ChildAccount } from '@/features/dashboard/views';
import { InstallSheet } from './install-sheet';
import { InstallContent } from './install-content';

export type InstallProps = {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ child?: string; error?: string; ready?: string }>;
};
async function installation(locale: Locale, child?: string) {
  const { db } = await requireUser(locale);
  let query = db
    .from('children')
    .select('id,family_id')
    .order('created_at')
    .limit(1);
  if (child) query = query.eq('id', child);
  const { data, error } = await query;
  if (error) throw new Error('Child unavailable');
  const selected = data?.[0];
  if (!selected) redirect(`/${locale}/today`);
  const [icon, owner] = await Promise.all([
    db
      .from('child_app_icons')
      .select('token')
      .eq('child_id', selected.id)
      .maybeSingle(),
    db.rpc('is_family_owner', { fid: selected.family_id }),
  ]);
  if (icon.error || owner.error) throw new Error('Installation unavailable');
  return { selected, token: icon.data?.token, owner: Boolean(owner.data) };
}
export async function installationMetadata({
  params,
  searchParams,
}: InstallProps): Promise<Metadata> {
  const { locale } = await params;
  const { token } = await installation(locale, (await searchParams).child);
  return {
    title: { absolute: appName(locale) },
    applicationName: appName(locale),
    robots: { index: false, follow: false },
    ...(token
      ? {
          manifest: appManifestPath(locale, token),
          icons: {
            icon: `/api/app-icon/${token}/192`,
            apple: `/api/app-icon/${token}/180`,
          },
        }
      : {
          manifest: appManifestPath(locale),
          icons: {
            icon: '/icons/podung-192.png?v=full-20261029',
            apple: '/icons/podung-180.png?v=full-20261029',
          },
        }),
    appleWebApp: {
      capable: true,
      title: appName(locale),
      statusBarStyle: 'default',
      startupImage: appleStartupImages(),
    },
  };
}
export async function Installation({ params, searchParams }: InstallProps) {
  const { locale } = await params;
  const query = await searchParams;
  const { selected, token, owner } = await installation(locale, query.child);
  const context = await loadFamily(locale, selected.id);
  return (
    <>
      {appleStartupImages().map((image) => (
        <link
          key={image.media}
          rel="preload"
          as="image"
          href={image.url}
          media={image.media}
        />
      ))}
      <div inert aria-hidden="true">
        <Shell context={context} locale={locale} section="account">
          <ChildAccount
            context={context}
            locale={locale}
            showInstallGuide={false}
          />
        </Shell>
      </div>
      <InstallSheet locale={locale} child={selected.id}>
        <InstallContent
          locale={locale}
          child={selected.id}
          token={token}
          owner={owner}
          prepared={query.ready === '1'}
          error={query.error}
        />
      </InstallSheet>
    </>
  );
}
