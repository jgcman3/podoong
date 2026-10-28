import { cache } from 'react';
import { calendarEntry } from '@/features/care/calendar-model';
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
  let accountActive = active.data;
  if (active.error) {
    if (active.error.code !== 'PGRST202')
      throw new Error('Account status unavailable');
    // A staged upgrade may not expose the RPC yet. Check deletion requests
    // directly; only an absent queue means this project predates B4.
    const jobs = await db
      .from('data_operation_jobs')
      .select('id')
      .eq('user_id', data.user.id)
      .limit(1);
    if (jobs.error && jobs.error.code !== 'PGRST205')
      throw new Error('Account status unavailable');
    accountActive = jobs.error?.code === 'PGRST205' || jobs.data?.length === 0;
  }
  if (!accountActive) redirect(`/${locale}/login?notice=deletion-requested`);
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
  const { data: access, error: accessError } = await db
    .rpc('family_access_context', { p_child: child.id })
    .single();
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
    writable: access.writable,
    timezone,
    today: dateInTimeZone(new Date(), timezone),
  };
});

export async function loadCare(
  locale: Locale,
  childId?: string,
  datasets: readonly ('records' | 'tasks' | 'events')[] = [
    'records',
    'tasks',
    'events',
  ],
  options: { page?: string; todayOnly?: boolean; service?: string } = {},
) {
  const context = await loadFamily(locale, childId);
  const { db, child } = context;
  const rawPage = Number(options.page ?? 0);
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
  const start = page * 100;
  let taskQuery = db
    .from('tasks')
    .select('*')
    .eq('child_id', child.id)
    .order('due_date', { nullsFirst: false })
    .order('id');
  let eventQuery = db
    .from('calendar_entries')
    .select('*')
    .eq('child_id', child.id)
    .order('date')
    .order('event_time', { nullsFirst: false })
    .order('source')
    .order('id');
  if (options.service) taskQuery = taskQuery.eq('service', options.service);
  if (options.todayOnly) {
    taskQuery = taskQuery
      .eq('due_date', context.today)
      .neq('status', 'snoozed');
    eventQuery = eventQuery.eq('date', context.today).eq('status', 'planned');
  }
  const [records, active, tasks, events] = await Promise.all([
    datasets.includes('records')
      ? db
          .from('care_records')
          .select('*')
          .eq('child_id', child.id)
          .order('started_at', { ascending: false })
          .order('id')
          .range(start, start + 100)
      : Promise.resolve({ data: [] as Row<'care_records'>[], error: null }),
    datasets.includes('records')
      ? db
          .from('care_records')
          .select('*')
          .eq('child_id', child.id)
          .eq('kind', 'breast')
          .is('ended_at', null)
      : Promise.resolve({ data: [] as Row<'care_records'>[], error: null }),
    datasets.includes('tasks')
      ? taskQuery.range(start, start + 100)
      : Promise.resolve({ data: [] as Row<'tasks'>[], error: null }),
    datasets.includes('events')
      ? eventQuery.range(start, start + 100)
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);
  if ([records, active, tasks, events].some((r) => r.error))
    throw new Error('Care data unavailable');
  const recordRows = [
    ...new Map(
      [...(records.data ?? []).slice(0, 100), ...(active.data ?? [])].map(
        (r) => [r.id, r],
      ),
    ).values(),
  ].sort((a, b) => b.started_at.localeCompare(a.started_at));
  return {
    ...context,
    records: recordRows,
    tasks: (tasks.data ?? []).slice(0, 100),
    events: (events.data ?? []).slice(0, 100).map(calendarEntry),
    page,
    hasMore: [records, tasks, events].some((r) => (r.data?.length ?? 0) > 100),
  };
}
export type CareContext = Awaited<ReturnType<typeof loadCare>>;
