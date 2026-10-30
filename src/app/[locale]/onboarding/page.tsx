import { RelationshipField } from '@/features/family/relationship-field';
import { ChildSexField } from '@/features/family/sex-field';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/data';
import { onboard, consentForInvite } from '@/features/family/actions';
import { BrandImage } from '@/components/brand-image';
import { Flash } from '@/components/flash';
import { SignupConsent } from '@/features/legal/signup-consent';
import { redirect } from 'next/navigation';
import { safeReturnPath, type Locale } from '@/lib/domain';
export default async function Onboarding({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { locale } = await params;
  const q = await searchParams;
  const { db, user } = await requireUser(locale);
  const t = await getTranslations();
  const next = safeReturnPath(q.next, locale);
  const invitation = next.startsWith(`/${locale}/invite/`);
  const [profileResult, agreement, children] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    db.rpc('has_signup_agreement'),
    db.from('children').select('id').limit(1),
  ]);
  if (profileResult.error || agreement.error || children.error)
    throw new Error('Signup information unavailable');
  const profile = profileResult.data;
  if (agreement.data && profile?.consented_at && children.data?.length)
    redirect(next);
  const ko = locale === 'ko';
  return (
    <main className="onboarding-page">
      <div className="onboard-card">
        <BrandImage />
        <span className="eyebrow">{agreement.data ? '02' : '01'} / 02</span>
        <h1>
          {agreement.data
            ? t('onboard')
            : ko
              ? '포둥 시작하기'
              : 'Start with podoong'}
        </h1>
        <p>
          {agreement.data
            ? t('onboardSub')
            : ko
              ? '정보를 입력하기 전에 약관을 확인해 주세요.'
              : 'Review the agreements before entering your information.'}
        </p>
        <Flash error={q.error} />
        {!agreement.data ? (
          <SignupConsent locale={locale} next={next} />
        ) : (
          <form
            action={invitation ? consentForInvite : onboard}
            className="form-stack"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            <label>
              {t('displayName')}
              <input
                name="name"
                required
                maxLength={60}
                defaultValue={
                  profile?.display_name ||
                  String(
                    user.user_metadata?.name ??
                      user.user_metadata?.full_name ??
                      '',
                  ).slice(0, 60)
                }
              />
            </label>
            {!invitation && (
              <>
                <label>
                  {t('familyName')}
                  <input name="family" required maxLength={60} />
                </label>
                <label>
                  {t('childName')}
                  <input name="child" required maxLength={60} />
                </label>
                <ChildSexField locale={locale} />
                <RelationshipField locale={locale} />
                <div className="form-row">
                  <label>
                    {t('birthDate')}
                    <input name="birth" type="date" required />
                  </label>
                </div>
                <label>
                  {t('timezone')}
                  <select name="timezone" defaultValue="Asia/Seoul">
                    {[
                      'Asia/Seoul',
                      'UTC',
                      'America/New_York',
                      'Europe/London',
                      'Asia/Tokyo',
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <p className="small muted">{t('consentHelp')}</p>
            <button className="button primary">
              {invitation ? t('acceptInvite') : t('start')}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
