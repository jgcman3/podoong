'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { safeReturnPath } from '@/lib/domain';
import { residenceSchema } from './residence-schema';
const birthDate = z.iso
  .date()
  .refine(
    (date) =>
      date <=
      new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }),
  );
const uuid = z.uuid();
function familyReturn(form: FormData, locale: Locale) {
  const page = form.get('returnPage') === 'account' ? 'account' : 'family';
  const section = form.get('panel');
  const panel = section === 'child' || section === 'add' ? section : 'family';
  return `/${locale}/${page}?panel=${panel}`;
}
export async function saveFamilyResidence(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const value = residenceSchema.safeParse(Object.fromEntries(form));
  if (!value.success) {
    const child = uuid.safeParse(form.get('childId'));
    redirect(
      `${familyReturn(form, locale)}&${child.success ? `child=${child.data}&` : ''}error=invalid`,
    );
  }
  const v = value.data;
  const child = await db
    .from('children')
    .select('family_id')
    .eq('id', v.childId)
    .maybeSingle();
  if (child.error || child.data?.family_id !== v.familyId)
    redirect(`${familyReturn(form, locale)}&child=${v.childId}&error=invalid`);
  const result =
    !v.regionCode && v.countryCode
      ? await db.rpc('save_family_residence_country', {
          p_family: v.familyId,
          p_country_code: v.countryCode,
          p_version: v.version,
        })
      : await db.rpc('save_family_residence_region', {
          p_family: v.familyId,
          p_region_code: v.regionCode,
          p_country_code: v.countryCode,
          p_version: v.version,
        });
  redirect(
    `${familyReturn(form, locale)}&child=${v.childId}&${result.error ? `error=${result.error.message.includes('conflict') ? 'conflict' : 'generic'}` : 'notice=saved'}`,
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
      birth: birthDate,
      sex: z.enum(['female', 'male']),
      timezone: z.enum([
        'Asia/Seoul',
        'UTC',
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
      ]),
    })
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
    p_birth_date: v.birth,
    p_sex: v.sex,
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
      birth: birthDate,
      sex: z.enum(['female', 'male']),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${familyReturn(form, locale)}&error=invalid`);
  const v = parsed.data;
  const childId = crypto.randomUUID();
  // The child_read policy looks up the child through a STABLE function;
  // INSERT RETURNING cannot see that new row in the statement snapshot.
  const { error } = await db.from('children').insert({
    id: childId,
    family_id: v.familyId,
    name: v.name,
    birth_date: v.birth,
    sex: v.sex,
  });
  if (error) redirect(`${familyReturn(form, locale)}&error=generic`);
  redirect(
    form.get('returnPage') === 'account'
      ? `/${locale}/account?child=${childId}`
      : `/${locale}/today?child=${childId}`,
  );
}

export async function createInvite(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const parsed = z
    .object({ childId: uuid, role: z.enum(['editor', 'viewer']) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${familyReturn(form, locale)}&error=invalid`);
  const { data, error } = await db.rpc('create_invitation', {
    p_child_id: parsed.data.childId,
    p_role: parsed.data.role,
  });
  if (error || !data) redirect(`${familyReturn(form, locale)}&error=generic`);
  // Carry the one-time link in a short-lived HttpOnly cookie, never persist its raw token in the DB or URL query.
  const { cookies } = await import('next/headers');
  (await cookies()).set('podung_invite', data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300,
    path: `/${locale}/${form.get('returnPage') === 'account' ? 'account' : 'family'}`,
  });
  redirect(
    `${familyReturn(form, locale)}&child=${parsed.data.childId}&notice=saved`,
  );
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
    redirect(`${familyReturn(form, locale)}&error=invalid`);
  const result =
    form.get('kind') === 'invite'
      ? await db.rpc('revoke_invitation', { p_id: id.data })
      : await db.rpc('revoke_member', {
          p_family_id: familyId.data,
          p_user_id: id.data,
        });
  redirect(
    `${familyReturn(form, locale)}&${result.error ? 'error=generic' : 'notice=saved'}&child=${String(form.get('childId') ?? '')}`,
  );
}

export async function saveBirthDate(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const parsed = z
    .object({ childId: uuid, birth: birthDate })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${familyReturn(form, locale)}&error=invalid`);
  const { childId, birth } = parsed.data;
  const { error } = await db.rpc('update_child_birth_date', {
    p_child_id: childId,
    p_birth_date: birth,
  });
  redirect(
    `${familyReturn(form, locale)}&child=${childId}&${error ? 'error=generic' : 'notice=saved'}`,
  );
}

export async function saveChildDetails(form: FormData) {
  const locale: Locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const parsed = z
    .object({
      childId: uuid,
      name: z.string().trim().min(1).max(60),
      sex: z.enum(['female', 'male']),
      birth: birthDate,
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`${familyReturn(form, locale)}&error=invalid`);
  const v = parsed.data;
  const { error } = await db.rpc('update_child_details', {
    p_child_id: v.childId,
    p_name: v.name,
    p_sex: v.sex,
    p_birth_date: v.birth,
  });
  redirect(
    `${familyReturn(form, locale)}&child=${v.childId}&${error ? 'error=generic' : 'notice=saved'}`,
  );
}
