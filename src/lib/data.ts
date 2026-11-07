import { privacyStateSchema } from '@/features/privacy/model';
import { z } from 'zod';
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
  const requestedChild = z.uuid().safeParse(childId);
  const { data: snapshot, error } = await db
    .rpc(
      'app_family_snapshot',
      requestedChild.success ? { p_child: requestedChild.data } : {},
    )
    .single();
  if (error || !snapshot) throw new Error('Family data unavailable');
  const profile = snapshot.profile as Row<'profiles'> | null;
  const children = snapshot.children as Row<'children'>[];
  if (!profile?.consented_at || !children?.length || !snapshot.child)
    redirect(`/${locale}/onboarding`);
  const child = snapshot.child as Row<'children'>;
  const privacy = privacyStateSchema.parse(snapshot.privacy);
  if (!privacy.authority) redirect(`/${locale}/onboarding`);
  if (snapshot.owner && !privacy.childGranted)
    redirect(`/${locale}/onboarding?mode=new`);
  if (!snapshot.family) throw new Error('Permissions unavailable');
  const timezone = profile.timezone;
  return {
    db,
    user,
    recentlyAuthenticated,
    profile,
    children,
    child,
    family: snapshot.family as Row<'families'>,
    members: snapshot.members as Row<'family_members'>[],
    caregivers: snapshot.caregivers as {
      user_id: string;
      display_name: string;
      role: string;
    }[],
    owner: snapshot.owner,
    writable: snapshot.writable && privacy.childGranted,
    privacy,
    timezone,
    today: dateInTimeZone(new Date(), timezone),
  };
});

export type CareContext = Awaited<ReturnType<typeof loadFamily>>;
