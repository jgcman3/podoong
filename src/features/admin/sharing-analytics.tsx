import type { Locale } from '@/lib/domain';
import { sharingUsageSchema } from './model';

export function SharingAnalytics({
  data,
  locale,
}: {
  data: ReturnType<typeof sharingUsageSchema.parse>;
  locale: Locale;
}) {
  const ko = locale === 'ko',
    invite = data.invitations;
  const labels = {
    introduction_copy: ko ? '소개 링크 복사' : 'Introduction link copies',
    introduction_share_attempt: ko
      ? '소개 링크 공유 시도'
      : 'Introduction share attempts',
    moment_save_attempt: ko
      ? '일기 카드 저장 시도'
      : 'Diary card save attempts',
    moment_share_attempt: ko
      ? '일기 카드 공유 시도'
      : 'Diary card share attempts',
  };
  return (
    <>
      <section
        className="admin-panel"
        aria-label={ko ? '가족 초대 전환' : 'Family invitation conversion'}
      >
        <h2>
          {ko
            ? '가족 초대 생성·참여'
            : 'Family invitation creation & acceptance'}
        </h2>
        <div className="admin-summary-grid">
          {[
            [ko ? '생성한 초대' : 'Invitations created', invite.created],
            [ko ? '참여 완료' : 'Accepted', invite.accepted],
            [ko ? '참여 대기' : 'Awaiting acceptance', invite.pending],
          ].map(([label, value]) => (
            <div key={label} className="admin-metric">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          <div className="admin-metric">
            <span>{ko ? '초대 수락률' : 'Acceptance rate'}</span>
            <strong>
              {invite.created
                ? `${Math.round((invite.accepted / invite.created) * 100)}%`
                : '—'}
            </strong>
          </div>
        </div>
        <p className="admin-caption">
          {ko
            ? '선택 기간에 생성한 초대의 현재 참여 상태입니다. 계측 도입 후 새로 생성된 초대부터 집계하며, 만료·철회된 초대도 생성 수에 포함됩니다.'
            : 'Current status of invitations created during the selected period. Only invitations created after tracking began are counted; expired and revoked invitations remain in the creation total.'}
        </p>
      </section>
      <section
        className="admin-panel"
        aria-label={
          ko ? '소개·일기 카드 이용' : 'Introduction & diary card usage'
        }
      >
        <h2>{ko ? '포둥 소개·일기 카드' : 'Introductions & diary cards'}</h2>
        <div className="admin-summary-grid">
          {data.actions.map((item) => (
            <div key={item.action} className="admin-metric">
              <span>{labels[item.action]}</span>
              <strong>{item.attempts}</strong>
            </div>
          ))}
        </div>
        <p className="admin-caption">
          {ko
            ? '소개 링크 복사는 복사 완료 횟수, 공유·저장은 버튼 실행 시도 횟수입니다. 공유 취소·반복 시도가 포함되며, 수신·저장 완료나 고유 사용자 수를 뜻하지 않습니다. 개인 식별자와 사진·문구·링크 원문은 수집하지 않으며, 기기의 통계 거부와 추적 방지 설정을 따릅니다. 계측 도입 이후의 건수만 표시합니다.'
            : 'Link copies count completed copies. Shares and saves count attempts, including cancellation and repeated attempts, not receipt, completed downloads or unique users. No identifiers, photo content, captions or full links are collected. Device opt-out and Do Not Track are respected. Only activity after tracking began is counted.'}
        </p>
      </section>
    </>
  );
}
