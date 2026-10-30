import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient, configured } from '@/lib/supabase/server';
import type { Locale } from '@/lib/domain';
export const adminSession = cache(async (locale: Locale) => {
  const next = `/${locale}/admin`;
  if (!configured())
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  const db = await createClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user)
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  const member = await db.rpc('is_service_admin');
  if (member.error) throw new Error('Admin access unavailable');
  if (!member.data) notFound();
  return { db, user: data.user };
});
export const requireAdmin = adminSession;
