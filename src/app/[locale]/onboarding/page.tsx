import { RelationshipField } from '@/features/family/relationship-field';
import { ChildSexField } from '@/features/family/sex-field';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/data';
import { onboard, consentForInvite } from '@/features/family/actions';
import { Nest } from '@/components/nest';
import { Flash } from '@/components/flash';
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
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  const next = safeReturnPath(q.next, locale);
  const invitation = next.startsWith(`/${locale}/invite/`);
  return (
    <main className="onboarding-page">
      <div className="onboard-card">
        <Nest />
        <span className="eyebrow">OUR LITTLE BEGINNING</span>
        <h1>{t('onboard')}</h1>
        <p>{t('onboardSub')}</p>
        <Flash error={q.error} />
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
              defaultValue={profile?.display_name}
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
          <label className="check-label">
            <input name="consent" type="checkbox" required />
            {t('consent')}
          </label>
          <p className="small muted">{t('consentHelp')}</p>
          <button className="button primary">
            {invitation ? t('acceptInvite') : t('start')}
          </button>
        </form>
      </div>
    </main>
  );
}
