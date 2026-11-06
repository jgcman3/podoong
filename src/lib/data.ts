import { privacyStateSchema } from '@/features/privacy/model';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient, configured } from './supabase/server';
import { dateInTimeZone, hasRecentAuthentication, type Locale } from './domain';
import type { Row } from './db';

export const requireUser = cache(async (locale: Locale) => {
  if (!configured()) redirect(`/${locale}/login`);
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) redirect(`/${locale}/login`);
  const [{ data: claims, error: claimsError }, active] = await Promise.all([
    db.auth.getClaims(),
    db.rpc('account_active'),
  ]);
  if (claimsError || claims?.claims.sub !== data.user.id)
    redirect(`/${locale}/login`);
  if (active.error) throw new Error('Account status unavailable');
  if (!active.data) redirect(`/${locale}/login?notice=deletion-requested`);
  return {
    db,
    user: data.user,
    recentlyAuthenticated: hasRecentAuthentication(claims?.claims.amr),
  };
});

export const loadFamily = cache(async (locale: Locale, childId?: string) => {
  const { db, user, recentlyAuthenticated } = await requireUser(locale);
  const [
    { data: profile, error: profileError },
    { data: children, error: childrenError },
  ] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    db.from('children').select('*').order('created_at'),
  ]);
  if (profileError || childrenError) throw new Error('Family data unavailable');
  if (!profile?.consented_at || !children?.length)
    redirect(`/${locale}/onboarding`);
  const child = children.find((c) => c.id === childId) ?? children[0];
  const [accessResult, privacyResult] = await Promise.all([
    db.rpc('family_access_context', { p_child: child.id }).single(),
    db.rpc('privacy_state', { p_child: child.id }),
  ]);
  const { data: access, error: accessError } = accessResult;
  if (privacyResult.error) throw new Error('Privacy information unavailable');
  const privacy = privacyStateSchema.parse(privacyResult.data);
  if (!privacy.authority) redirect(`/${locale}/onboarding`);
  if (access?.owner && !privacy.childGranted)
    redirect(`/${locale}/onboarding?mode=new`);
  if (accessError || !access?.family)
    throw new Error('Permissions unavailable');
  const timezone = profile.timezone;
  return {
    db,
    user,
    recentlyAuthenticated,
    profile,
    children,
    child,
    family: access.family as Row<'families'>,
    members: access.members as Row<'family_members'>[],
    caregivers: access.caregivers as {
      user_id: string;
      display_name: string;
      role: string;
    }[],
    owner: access.owner,
    writable: access.writable && privacy.childGranted,
    privacy,
    timezone,
    today: dateInTimeZone(new Date(), timezone),
  };
});

export type CareContext = Awaited<ReturnType<typeof loadFamily>>;
