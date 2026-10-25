'use server';
import { redirect } from 'next/navigation';
import { createClient, configured } from '@/lib/supabase/server';
import { isLocale, safeReturnPath, type Locale } from '@/lib/domain';
import { requireUser } from '@/lib/data';

export async function socialLogin(form: FormData) {
  const inputLocale = String(form.get('locale'));
  const locale: Locale = isLocale(inputLocale) ? inputLocale : 'ko';
  const next = safeReturnPath(String(form.get('next') ?? ''), locale);
  const loginError = (error: string) =>
    `/${locale}/login?error=${error}&next=${encodeURIComponent(next)}`;
  const providerName = String(form.get('provider'));
  if (!['google', 'kakao', 'naver'].includes(providerName) || !configured())
    redirect(loginError('auth'));
  const allowed = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '').split(',');
  if (!allowed.includes(providerName)) redirect(loginError('provider'));
  const provider =
    providerName === 'naver'
      ? 'custom:naver'
      : providerName === 'kakao'
        ? 'kakao'
        : 'google';
  const db = await createClient();
  const callback = new URL(
    '/auth/callback',
    process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3187',
  );
  callback.searchParams.set('locale', locale);
  callback.searchParams.set('next', next);
  const options = {
    redirectTo: callback.toString(),
    skipBrowserRedirect: true,
    // `scopes` adds to Supabase's defaults; singular `scope` replaces them.
    ...(provider === 'kakao'
      ? { queryParams: { scope: 'profile_nickname' } }
      : {}),
  };
  if (form.get('link') === 'true') {
    const { recentlyAuthenticated } = await requireUser(locale);
    if (!recentlyAuthenticated) redirect(`/${locale}/settings?error=reauth`);
    const { data, error } = await db.auth.linkIdentity({ provider, options });
    if (error || !data.url) redirect(`/${locale}/settings?error=auth`);
    redirect(data.url);
  }
  const { data, error } = await db.auth.signInWithOAuth({ provider, options });
  if (error || !data.url) redirect(loginError('auth'));
  redirect(data.url);
}

export async function logout(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db } = await requireUser(locale);
  const { error } = await db.auth.signOut();
  if (error) redirect(`/${locale}/settings?error=generic`);
  redirect(`/${locale}/login`);
}

export async function unlinkIdentity(form: FormData) {
  const locale = form.get('locale') === 'en' ? 'en' : 'ko';
  const { db, user, recentlyAuthenticated } = await requireUser(locale);
  if (!recentlyAuthenticated) redirect(`/${locale}/settings?error=reauth`);
  if ((user.identities?.length ?? 0) <= 1)
    redirect(`/${locale}/settings?error=lastIdentity`);
  const identity = user.identities?.find(
    (i) => i.identity_id === form.get('identityId'),
  );
  if (!identity) redirect(`/${locale}/settings?error=invalid`);
  const { error } = await db.auth.unlinkIdentity(identity);
  redirect(`/${locale}/settings?${error ? 'error=auth' : 'notice=saved'}`);
}
