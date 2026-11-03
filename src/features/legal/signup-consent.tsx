'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, ChevronDown, Minus } from 'lucide-react';
import type { ComponentProps } from 'react';
import styles from './signup-consent.module.css';
import type { Locale } from '@/lib/domain';
import { acceptSignupAgreements } from './signup-actions';
import { logout } from '@/features/auth/actions';
import { signupAgreementVersion } from './signup-model';

function ConsentCheckbox(props: ComponentProps<'input'>) {
  return (
    <span className={styles.box} data-consent-box>
      <input {...props} className={styles.native} />
      <span className={styles.mark} aria-hidden="true">
        <Check className={styles.check} />
        <Minus className={styles.mixed} />
      </span>
    </span>
  );
}

function subscribeHydration() {
  return () => {};
}

function Continue({ ko }: { ko: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="button primary" disabled={pending}>
      {ko ? '동의하고 계속하기' : 'Agree and continue'}
    </button>
  );
}

export function SignupConsent({
  locale,
  next,
}: {
  locale: Locale;
  next: string;
}) {
  const ko = locale === 'ko';
  const [choices, setChoices] = useState({
    terms: false,
    collection: false,
    health: false,
  });
  const ready = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const all = useRef<HTMLInputElement>(null);
  const allChecked = choices.terms && choices.collection && choices.health;
  useEffect(() => {
    if (all.current)
      all.current.indeterminate =
        !allChecked && Object.values(choices).some(Boolean);
  }, [allChecked, choices]);
  const choose = (name: keyof typeof choices, value: boolean) =>
    setChoices((current) => ({ ...current, [name]: value }));
  const link = (document: string, versioned = false) =>
    `/${locale}/legal/${document}?source=signup&next=${encodeURIComponent(next)}${versioned ? `&version=${signupAgreementVersion}` : ''}`;
  return (
    <>
      <form
        action={acceptSignupAgreements}
        className={`signup-consent form-stack ${styles.consent}`}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="next" value={next} />
        <input
          type="hidden"
          name="termsVersion"
          value={signupAgreementVersion}
        />
        <input
          type="hidden"
          name="collectionVersion"
          value={signupAgreementVersion}
        />
        <div className={`signup-consent-row signup-consent-all ${styles.row}`}>
          <label className={styles.label}>
            <ConsentCheckbox
              ref={all}
              type="checkbox"
              checked={allChecked}
              disabled={!ready}
              onChange={(event) => {
                const checked = event.target.checked;
                setChoices({
                  terms: checked,
                  collection: checked,
                  health: checked,
                });
              }}
            />
            <strong className={styles.title} data-consent-title>
              {ko ? '모두 동의' : 'Agree to all'}
            </strong>
          </label>
        </div>
        <div className={`signup-consent-row ${styles.row}`}>
          <label className={styles.label}>
            <ConsentCheckbox
              name="terms"
              aria-label={
                ko
                  ? '[필수] 서비스 이용약관에 동의합니다'
                  : '[Required] I agree to the Terms of Service'
              }
              type="checkbox"
              required
              checked={choices.terms}
              onChange={(event) => choose('terms', event.target.checked)}
            />
            <span className={styles.title} data-consent-title>
              {ko ? '[필수] 이용약관' : '[Required] Terms of Service'}
            </span>
          </label>
          <Link
            href={link('terms', true)}
            aria-label={
              ko ? '서비스 이용약관 전문 보기' : 'Read the Terms of Service'
            }
          >
            {ko ? '보기' : 'View'}
          </Link>
        </div>
        <div className="signup-consent-choice">
          <div className={`signup-consent-row ${styles.row}`}>
            <label className={styles.label}>
              <ConsentCheckbox
                name="collection"
                aria-label={
                  ko
                    ? '[필수] 보호자·아이 개인정보 수집·이용에 동의합니다'
                    : '[Required] I agree to processing caregiver and child information'
                }
                type="checkbox"
                required
                checked={choices.collection}
                onChange={(event) => choose('collection', event.target.checked)}
              />
              <span className={styles.title} data-consent-title>
                {ko ? '[필수] 개인정보 수집·이용' : '[Required] Personal data'}
              </span>
            </label>
            <Link
              href={link('signup-privacy', true)}
              aria-label={
                ko
                  ? '가입 개인정보 수집·이용 안내 전문 보기'
                  : 'Read the account information collection notice'
              }
            >
              {ko ? '보기' : 'View'}
            </Link>
          </div>
          <p className="small muted signup-consent-description">
            {ko
              ? '개인정보 동의에는 성인 보호자로서 아이의 법정대리인이거나 적법한 위임을 받았다는 선언이 포함됩니다. 가족 돌봄에 보호자·아이 닉네임, 태어난 날·성별·가족 관계를 사용하고 계정·아이 삭제 시 삭제합니다. 동의하지 않으면 가입할 수 없습니다.'
              : 'By agreeing, you declare that you are an adult legal guardian or an authorized caregiver. Caregiver/child nickname, birth date, sex and family relationships support family care, until account/child deletion. Required to sign up.'}
          </p>
        </div>
        <div className="signup-consent-choice">
          <div className={`signup-consent-row ${styles.row}`}>
            <label className={styles.label}>
              <ConsentCheckbox
                type="checkbox"
                name="health"
                aria-label={
                  ko
                    ? '[필수] 아이 건강정보 기록·분석에 동의합니다'
                    : '[Required] I consent to recording and analyzing child health information'
                }
                required
                checked={choices.health}
                onChange={(event) => choose('health', event.target.checked)}
              />
              <span className={styles.title} data-consent-title>
                {ko ? '[필수] 건강정보 수집·이용' : '[Required] Health data'}
              </span>
            </label>
            <Link
              href={link('signup-privacy', true)}
              aria-label={
                ko
                  ? '건강정보 수집·이용 안내 전문 보기'
                  : 'Read the health information processing notice'
              }
            >
              {ko ? '보기' : 'View'}
            </Link>
          </div>
          <p className="small muted signup-consent-description">
            {ko
              ? '체온·진료·투약·접종과 성장 수치 등 건강정보를 돌봄·분석에 사용하고 동의 철회 또는 해당 기록·아이 삭제 시 삭제합니다. 가입 시 필요한 동의이며, 동의하지 않으면 가입을 완료할 수 없습니다.'
              : 'Health details including temperature, medical care, medication, vaccinations and growth measurements are used for care and analysis until withdrawal or record/child deletion. Required to complete signup. You may decline, but cannot complete signup without this consent.'}
          </p>
        </div>
        <details className="signup-collection-summary">
          <summary>
            {ko
              ? '수집 항목과 이용기간'
              : 'Information collected and retention'}
            <ChevronDown size={14} aria-hidden="true" />
          </summary>
          <dl>
            <div>
              <dt>{ko ? '목적' : 'Purpose'}</dt>
              <dd>
                {ko
                  ? '회원 식별, 보호자 프로필 및 가족 권한 관리'
                  : 'Account identification, caregiver profiles and family access'}
              </dd>
            </div>
            <div>
              <dt>{ko ? '항목' : 'Information'}</dt>
              <dd>
                {ko
                  ? '소셜 식별자·기본 프로필, 보호자 이름, 아이 닉네임·태어난 날·성별, 언어·시간대, 가족·관계·거주지역, 권한 선언과 동의 이력. 이메일은 제공된 경우만 수집합니다.'
                  : 'Social identifier and basic profile, caregiver name, language, time zone, family and relationship information, and agreement history. Email only when provided.'}
              </dd>
            </div>
            <div>
              <dt>{ko ? '기간' : 'Retention'}</dt>
              <dd>
                {ko
                  ? '탈퇴 또는 처리 목적 달성 시까지. 동의 이력도 계정 삭제 대상에 포함됩니다.'
                  : 'Until account deletion or fulfilment of the purpose. Agreement history is included in account deletion.'}
              </dd>
            </div>
            <div>
              <dt>{ko ? '거부 시' : 'If declined'}</dt>
              <dd>
                {ko
                  ? '가입에 필요한 정보 처리에 동의하지 않으면 서비스를 시작할 수 없습니다.'
                  : 'You cannot start the account service without agreement to this necessary processing.'}
              </dd>
            </div>
          </dl>
        </details>
        <Link className="signup-privacy-link" href={link('privacy')}>
          {ko ? '개인정보 처리방침' : 'Privacy Policy'}
        </Link>
        <Continue ko={ko} />
      </form>
      <form action={logout} className="signup-decline">
        <input type="hidden" name="locale" value={locale} />
        <button className="button secondary">
          {ko ? '동의하지 않고 나가기' : 'Leave without agreeing'}
        </button>
      </form>
    </>
  );
}
