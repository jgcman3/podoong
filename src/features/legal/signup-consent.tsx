'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { acceptSignupAgreements } from './signup-actions';
import { logout } from '@/features/auth/actions';
import { signupAgreementVersion } from './signup-model';

function Continue({ ko, enabled }: { ko: boolean; enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="button primary" disabled={!enabled || pending}>
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
  const [terms, setTerms] = useState(false),
    [collection, setCollection] = useState(false);
  const link = (document: string, versioned = false) =>
    `/${locale}/legal/${document}?source=signup&next=${encodeURIComponent(next)}${versioned ? `&version=${signupAgreementVersion}` : ''}`;
  return (
    <>
      <form
        action={acceptSignupAgreements}
        className="signup-consent form-stack"
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
        <div className="signup-consent-row">
          <label>
            <input
              name="terms"
              type="checkbox"
              required
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
            />
            <span>
              {ko
                ? '[필수] 서비스 이용약관에 동의합니다'
                : '[Required] I agree to the Terms of Service'}
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
        <div className="signup-consent-row">
          <label>
            <input
              name="collection"
              type="checkbox"
              required
              checked={collection}
              onChange={(event) => setCollection(event.target.checked)}
            />
            <span>
              {ko
                ? '[필수] 가입 개인정보 수집·이용에 동의합니다'
                : '[Required] I agree to collection and use of account information'}
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
                  ? '소셜 식별자·기본 프로필, 보호자 이름, 언어·시간대, 가족·관계 정보, 동의 이력. 이메일은 제공된 경우만 수집합니다.'
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
        <p className="small muted">
          {ko
            ? '개발 테스트용 초안입니다. 실제 개인정보는 입력하지 마세요. 아이 정보·건강정보·일기 공개에 대한 동의를 대신하지 않습니다.'
            : 'Draft for development testing. Do not enter real personal information. This does not cover child information, health data or public diary sharing.'}
          {!ko && ' Full documents are currently provided in Korean.'}
        </p>
        <Continue ko={ko} enabled={terms && collection} />
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
