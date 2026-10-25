'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { safeReturnPath } from '@/lib/domain';
import { residenceSchema } from './residence-schema';
const optionalDate = z
  .union([z.literal(''), z.iso.date()])
  .transform((v) => v || null);
const dates = z
  .object({ due: optionalDate, birth: optionalDate })
  .refine((v) => v.due || v.birth);
const uuid = z.uuid();
export async function saveFamilyResidence(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const value = residenceSchema.safeParse(Object.fromEntries(form));
  if (!value.success) {
    const child = uuid.safeParse(form.get('childId'));
    redirect(
      `/${locale}/family?${child.success ? `child=${child.data}&` : ''}error=invalid`,
    );
  }
  const v = value.data;
  const child = await db
    .from('children')
    .select('family_id')
    .eq('id', v.childId)
    .maybeSingle();
  if (child.error || child.data?.family_id !== v.familyId)
    redirect(`/${locale}/family?child=${v.childId}&error=invalid`);
  const result = await db.rpc('save_family_residence_region', {
    p_family: v.familyId,
    p_region_code: v.regionCode,
    p_country_code: 'KR',
    p_version: v.version,
  });
  redirect(
    `/${locale}/family?child=${v.childId}&${result.error ? `error=${result.error.message.includes('conflict') ? 'conflict' : 'generic'}` : 'notice=saved'}`,
  );
}
export async function onboard(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db, user } = await requireUser(locale);
  const parsed = z
    .object({
      family: z.string().trim().min(1).max(60),
      child: z.string().trim().min(1).max(60),
      name: z.string().trim().min(1).max(60),
      consent: z.literal('on'),
      due: optionalDate,
      birth: optionalDate,
      timezone: z.enum([
        'Asia/Seoul',
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
      ]),
    })
    .refine((v) => v.due || v.birth)
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/onboarding?error=invalid`);
  const v = parsed.data;
  const { error } = await db.from('profiles').upsert({
    id: user.id,
    display_name: v.name,
    locale,
    timezone: v.timezone,
    consented_at: new Date().toISOString(),
  });
  if (error) redirect(`/${locale}/onboarding?error=generic`);
  const next = safeReturnPath(String(form.get('next') ?? ''), locale);
  if (next.startsWith(`/${locale}/invite/`)) redirect(next);
  // A browser double-submit must not create a second family after successful onboarding.
  const { data: existing } = await db.from('children').select('id').limit(1);
  if (existing?.length) redirect(`/${locale}/today?child=${existing[0].id}`);
  const result = await db.rpc('create_family_with_child', {
    p_family_name: v.family,
    p_child_name: v.child,
    p_due_date: v.due,
    p_birth_date: v.birth,
  });
  if (result.error) redirect(`/${locale}/onboarding?error=generic`);
  redirect(`/${locale}/today?child=${result.data}`);
}

export async function consentForInvite(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db, user } = await requireUser(locale);
  const name = String(form.get('name') ?? '').trim();
  const next = safeReturnPath(String(form.get('next')), locale);
  if (!name || name.length > 60 || form.get('consent') !== 'on')
    redirect(
      `/${locale}/onboarding?next=${encodeURIComponent(next)}&error=invalid`,
    );
  const { error } = await db.from('profiles').upsert({
    id: user.id,
    display_name: name,
    locale,
    consented_at: new Date().toISOString(),
  });
  redirect(
    error
      ? `/${locale}/onboarding?next=${encodeURIComponent(next)}&error=generic`
      : next,
  );
}

export async function addChild(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const parsed = z
    .object({
      familyId: uuid,
      name: z.string().trim().min(1).max(60),
      due: optionalDate,
      birth: optionalDate,
    })
    .refine((v) => v.due || v.birth)
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/family?error=invalid`);
  const v = parsed.data;
  const childId = crypto.randomUUID();
  // The child_read policy looks up the child through a STABLE function;
  // INSERT RETURNING cannot see that new row in the statement snapshot.
  const { error } = await db.from('children').insert({
    id: childId,
    family_id: v.familyId,
    name: v.name,
    due_date: v.due,
    birth_date: v.birth,
  });
  if (error) redirect(`/${locale}/family?error=generic`);
  redirect(`/${locale}/today?child=${childId}`);
}

export async function createInvite(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const parsed = z
    .object({ childId: uuid, role: z.enum(['editor', 'viewer']) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/${locale}/family?error=invalid`);
  const { data, error } = await db.rpc('create_invitation', {
    p_child_id: parsed.data.childId,
    p_role: parsed.data.role,
  });
  if (error || !data) redirect(`/${locale}/family?error=generic`);
  // Carry the one-time link in a short-lived HttpOnly cookie, never persist its raw token in the DB or URL query.
  const { cookies } = await import('next/headers');
  (await cookies()).set('podung_invite', data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: `/${locale}/family`,
  });
  redirect(`/${locale}/family?child=${parsed.data.childId}&notice=saved`);
}

export async function acceptInvite(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const token = String(form.get('token') ?? '');
  if (!/^[a-f0-9]{64}$/.test(token) || form.get('confirm') !== 'on')
    redirect(`/${locale}/invite/${encodeURIComponent(token)}?error=invite`);
  const { data, error } = await db.rpc('accept_invitation', { p_token: token });
  if (error) redirect(`/${locale}/invite/${token}?error=invite`);
  redirect(`/${locale}/today?child=${data}&notice=saved`);
}

export async function revoke(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const id = uuid.safeParse(form.get('id'));
  const familyId = uuid.safeParse(form.get('familyId'));
  if (!id.success || !familyId.success)
    redirect(`/${locale}/family?error=invalid`);
  const result =
    form.get('kind') === 'invite'
      ? await db.rpc('revoke_invitation', { p_id: id.data })
      : await db.rpc('revoke_member', {
          p_family_id: familyId.data,
          p_user_id: id.data,
        });
  redirect(
    `/${locale}/family?${result.error ? 'error=generic' : 'notice=saved'}&child=${String(form.get('childId') ?? '')}`,
  );
}

export async function previewDates(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  await requireUser(locale);
  const parsed = dates.safeParse(Object.fromEntries(form));
  const child = uuid.safeParse(form.get('childId'));
  if (!parsed.success || !child.success)
    redirect(`/${locale}/family?error=invalid`);
  const query = new URLSearchParams({
    child: child.data,
    due: parsed.data.due ?? '',
    birth: parsed.data.birth ?? '',
  });
  redirect(`/${locale}/dates?${query}`);
}
export async function applyDates(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const parsed = dates.safeParse(Object.fromEntries(form));
  const child = uuid.safeParse(form.get('childId'));
  if (!parsed.success || !child.success)
    redirect(`/${locale}/family?error=invalid`);
  const { error } = await db.rpc('update_child_dates', {
    p_child_id: child.data,
    p_due_date: parsed.data.due,
    p_birth_date: parsed.data.birth,
  });
  redirect(
    `/${locale}/family?child=${child.data}&${error ? 'error=generic' : 'notice=saved'}`,
  );
}
