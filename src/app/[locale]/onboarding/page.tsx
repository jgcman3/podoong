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
import Link from 'next/link';
import { Users, Baby, ChevronRight } from 'lucide-react';
import { FamilyJoinEntry } from '@/features/family/join-entry';
import { OnboardingForm } from '@/features/family/onboarding-form';
import { TimezoneField } from '@/features/family/timezone-field';
import { supportedTimeZones } from '@/lib/timezones';
export default async function Onboarding({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ error?: string; next?: string; mode?: string }>;
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
  const choosing = !invitation && q.mode !== 'new' && q.mode !== 'join';
  return (
    <main className="onboarding-page">
      <div className="onboard-card">
        <BrandImage />
        <span className="eyebrow">{agreement.data ? '02' : '01'} / 02</span>
        <h1>
          {agreement.data
            ? !invitation && q.mode !== 'new'
              ? ko
                ? '가족과 함께 시작하기'
                : 'Start with your family'
              : t('onboard')
            : ko
              ? '포둥 시작하기'
              : 'Start with podoong'}
        </h1>
        <p>
          {agreement.data
            ? !invitation && q.mode !== 'new'
              ? ko
                ? '가족이 이미 포둥을 사용하고 있나요?'
                : 'Is someone in your family already using podoong?'
              : t('onboardSub')
            : ko
              ? '정보를 입력하기 전에 약관을 확인해 주세요.'
              : 'Review the agreements before entering your information.'}
        </p>
        <Flash error={q.error} />
        {!agreement.data ? (
          <SignupConsent locale={locale} next={next} />
        ) : choosing ? (
          <div className="family-start-choices">
            <Link
              href={`/${locale}/onboarding?mode=new&next=${encodeURIComponent(next)}`}
            >
              <Baby size={24} aria-hidden="true" />
              <span>
                <strong>{ko ? '처음 시작해요' : 'Start a new family'}</strong>
                <small>
                  {ko
                    ? '아이를 등록하고 보호자를 초대해요'
                    : 'Add your child and invite caregivers'}
                </small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <Link
              href={`/${locale}/onboarding?mode=join&next=${encodeURIComponent(next)}`}
            >
              <Users size={24} aria-hidden="true" />
              <span>
                <strong>
                  {ko ? '가족이 이미 사용 중이에요' : 'Join an existing family'}
                </strong>
                <small>
                  {ko
                    ? '초대 링크로 같은 아이를 함께 돌봐요'
                    : 'Use an invitation to care for the same child'}
                </small>
              </span>
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
          </div>
        ) : !invitation && q.mode === 'join' ? (
          <>
            <FamilyJoinEntry locale={locale} />
            <Link className="text-link" href={`/${locale}/onboarding`}>
              {ko ? '돌아가기' : 'Back'}
            </Link>
          </>
        ) : (
          <OnboardingForm
            locale={locale}
            next={next}
            invitation={invitation}
            action={invitation ? consentForInvite : onboard}
            submitLabel={invitation ? t('acceptInvite') : t('start')}
            note={t('consentHelp')}
            fields={[
              ...(!invitation
                ? [
                    {
                      id: 'family',
                      content: (
                        <label>
                          {t('familyName')}
                          <input
                            name="family"
                            required
                            maxLength={60}
                            enterKeyHint="next"
                          />
                        </label>
                      ),
                    },
                  ]
                : []),
              {
                id: 'name',
                content: (
                  <label>
                    {t('displayName')}
                    <input
                      name="name"
                      required
                      maxLength={60}
                      enterKeyHint={invitation ? 'done' : 'next'}
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
                ),
              },
              ...(!invitation
                ? [
                    {
                      id: 'child',
                      content: (
                        <label>
                          {t('childName')}
                          <input
                            name="child"
                            required
                            maxLength={60}
                            enterKeyHint="next"
                          />
                        </label>
                      ),
                    },
                    { id: 'sex', content: <ChildSexField locale={locale} /> },
                    {
                      id: 'birth',
                      content: (
                        <label>
                          {t('birthDate')}
                          <input name="birth" type="date" required />
                        </label>
                      ),
                    },
                    {
                      id: 'relationship',
                      content: <RelationshipField locale={locale} personal />,
                    },
                    {
                      id: 'timezone',
                      content: (
                        <TimezoneField
                          locale={locale}
                          options={supportedTimeZones()}
                          initialTimeZone={profile?.timezone}
                        />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>
    </main>
  );
}
