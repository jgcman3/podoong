import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { makeBoards } from './boards';
export const loadCommunityContext = cache(
  async (locale: Locale, familyId?: string) => {
    const { db, user } = await requireUser(locale);
    const [profile, families, locations, children] = await Promise.all([
      db
        .from('profiles')
        .select('consented_at')
        .eq('id', user.id)
        .maybeSingle(),
      db
        .from('families')
        .select('id,name,residence_version')
        .order('created_at')
        .order('id'),
      db.rpc('community_board_locations'),
      db
        .from('children')
        .select('id,family_id')
        .order('created_at')
        .order('id'),
    ]);
    if (profile.error || families.error || locations.error || children.error)
      throw new Error('Community residence unavailable');
    if (!profile.data?.consented_at) redirect(`/${locale}/onboarding`);
    const family = familyId
      ? families.data.find((f) => f.id === familyId)
      : families.data[0];
    if (familyId && !family) notFound();
    const homeLocations = locations.data.filter(
      (l) => l.family_id === family?.id,
    );
    const child = children.data.find((c) => c.family_id === family?.id);
    return {
      db,
      user,
      family,
      families: families.data,
      locations: locations.data,
      boards: makeBoards(homeLocations, locale),
      residenceLink: child
        ? `/${locale}/family?child=${child.id}`
        : `/${locale}/onboarding`,
    };
  },
);
