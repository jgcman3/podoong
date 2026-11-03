'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/domain';
import type { PrivacyState } from './model';
import { savePrivacyChoices, saveChildVisibility } from './actions';
import { UsageStatisticsToggle } from '@/features/admin/usage-tracker';

export function PrivacySettings({
  locale,
  child,
  state,
}: {
  locale: Locale;
  child: string;
  state: PrivacyState;
}) {
  const ko = locale === 'ko';
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return (
    <div className="form-stack">
      {state.owner ? (
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setError('');
            start(async () => {
              const result = await savePrivacyChoices(data);
              if (result.error) setError(result.error);
              else router.refresh();
            });
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <p className="small muted">
            {ko
              ? '가입 때 선택한 건강정보 동의입니다. 이 보호자가 동의한 아이들에게 함께 적용됩니다.'
              : 'Choices made during signup apply to children covered by your consent.'}
          </p>
          {(
            [
              [
                'health',
                ko
                  ? '아이 건강정보 기록·분석'
                  : 'Child health recording and analysis',
              ],
            ] as const
          ).map(([name, label]) => (
            <label className="signup-consent-choice-label" key={name}>
              <input type="checkbox" name={name} defaultChecked={state[name]} />
              {label}
            </label>
          ))}
          <p className="small muted">
            {ko
              ? '일기 공개 철회 시 공유 링크를 끄고 공개 일기를 숨깁니다. 동네 프로필 공개 철회 시 동네 놀이터에서 숨깁니다. 기존 비공개 일기는 유지됩니다.'
              : 'Withdrawing public sharing disables links and hides public diaries. Withdrawing neighborhood consent hides your child from the playground. Private diaries remain.'}
          </p>
          <details>
            <summary>
              {ko
                ? '건강정보 동의 철회와 기록 삭제'
                : 'Withdrawing health consent and deleting records'}
            </summary>
            <p className="small muted">
              {ko
                ? '이미 건강 기록이 있다면 재로그인 후 아래에 DELETE HEALTH RECORDS 를 입력하고 건강정보 선택을 해제해 주세요. 신체 수치·체온·진료·투약·접종 등 구조화된 건강 기록을 삭제합니다. 일기 글·사진은 유지되므로 건강 내용이 있으면 직접 수정·삭제해 주세요.'
                : 'If health records exist, sign in again, type DELETE HEALTH RECORDS below and uncheck health consent. Structured measurements, temperature, medical and vaccination records are deleted. Diary text/photos remain; edit or remove any health content yourself.'}
            </p>
            <input
              name="confirmation"
              autoComplete="off"
              aria-label={
                ko
                  ? '건강 기록 삭제 확인 문구'
                  : 'Health record deletion confirmation'
              }
              placeholder="DELETE HEALTH RECORDS"
            />
          </details>
          {error && (
            <p role="alert">
              {error === 'health'
                ? ko
                  ? '건강 기록이 있어 삭제 확인이 필요합니다. 위의 삭제 안내를 확인해 주세요.'
                  : 'Health records exist. Read the deletion instructions above.'
                : ko
                  ? '변경하지 못했어요. 최근 로그인이 필요한 경우 다시 로그인 후 시도해 주세요.'
                  : 'Could not update. Sign in again if recent authentication is required.'}
            </p>
          )}
          <button className="button primary" disabled={pending}>
            {ko ? '동의 설정 저장' : 'Save consent choices'}
          </button>
          <Link
            className="text-link"
            href={`/${locale}/account?panel=data&child=${child}`}
          >
            {ko
              ? '아이 정보 수집 동의 철회: 아이 데이터 삭제'
              : 'Withdraw child information consent: delete child data'}
          </Link>
        </form>
      ) : (
        <p className="small muted">
          {ko
            ? '아이 정보 동의는 등록한 법정대리인·위임 보호자가 관리합니다.'
            : 'Child consent is managed by the legal guardian or authorized caregiver who provided it.'}
        </p>
      )}
      {state.owner &&
        (['public', 'neighborhood'] as const).map((scope) => (
          <form
            className="form-stack"
            key={`${child}:${scope}:${scope === 'public' ? state.publicSharing : state.neighborhood}`}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              start(async () => {
                const result = await saveChildVisibility(data);
                if (!result.error) router.refresh();
              });
            }}
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="child" value={child} />
            <input type="hidden" name="scope" value={scope} />
            <label className="signup-consent-choice-label">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={
                  scope === 'public' ? state.publicSharing : state.neighborhood
                }
              />
              {scope === 'public'
                ? ko
                  ? '이 아이의 성장일기 공개·공유 허용'
                  : 'Allow this child’s public diary sharing'
                : ko
                  ? '이 아이의 동네 놀이터 참여'
                  : 'Join the playground with this child'}
            </label>
            <p className="small muted">
              {scope === 'public'
                ? ko
                  ? '공개로 선택한 일기·사진·성장 수치만 다른 이용자와 링크 방문자에게 보입니다. 해제하면 공개 일기와 링크를 숨기며 외부 사본은 회수할 수 없습니다.'
                  : 'Only entries you publish, with photos and growth measurements, are visible to users and link visitors until withdrawn or deleted. Copies cannot be recalled.'
                : ko
                  ? '가족·아이 닉네임, 성별·나이와 상태가 같은 동네에 표시됩니다. 참여를 끄면 즉시 숨겨집니다.'
                  : 'Your family/child nickname, sex, age and status are visible to neighborhood users until you leave.'}
            </p>
            <button className="button secondary" disabled={pending}>
              {ko ? '설정 저장' : 'Save setting'}
            </button>
          </form>
        ))}
      <UsageStatisticsToggle locale={locale} />
      <p className="small muted">
        {ko
          ? '화면별 방문 횟수만 합산합니다. 아이 정보·사진·건강 기록·일기 내용은 통계로 보내지 않습니다. 이 설정은 이 브라우저에 적용됩니다.'
          : 'Only screen visit totals are counted. No child data, photos, health records or diary content are sent. This choice applies to this browser.'}
      </p>
      <Link
        className="text-link"
        href={`/${locale}/legal/consent?child=${child}`}
      >
        {ko ? '동의 항목 자세히 보기' : 'Read consent details'}
      </Link>
    </div>
  );
}
