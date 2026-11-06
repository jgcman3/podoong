import { MapPin } from 'lucide-react';
import { ResidenceForm } from '@/features/family/residence-form';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';

export function CommunityResidence({
  context,
  locale,
  area,
}: {
  context: CareContext;
  locale: Locale;
  area: 'friends' | 'neighborhood';
}) {
  const ko = locale === 'ko';
  return (
    <section className="community-residence panel form-stack">
      <span className="community-residence-icon">
        <MapPin size={24} aria-hidden="true" />
      </span>
      <h2>{ko ? '어느 동네에 살고 계세요?' : 'Which neighborhood is home?'}</h2>
      <p className="small muted">
        {ko
          ? '사는 동네를 선택하면 가까운 가족들과 만나고 이야기를 나눌 수 있어요. 상세 주소나 기기 위치는 사용하지 않아요.'
          : 'Choose your neighborhood to meet nearby families. No street address or device location is needed.'}
      </p>
      {context.owner ? (
        <ResidenceForm
          family={context.family}
          childId={context.child.id}
          locale={locale}
          returnPage={
            area === 'friends'
              ? 'community/playground'
              : 'community/neighborhood'
          }
        />
      ) : (
        <p className="small muted">
          {ko
            ? '가족관리자가 거주지역을 등록하면 함께 이용할 수 있어요. 가족관리자에게 동네 설정을 부탁해 주세요.'
            : 'Ask your family administrator to add your neighborhood so everyone can join.'}
        </p>
      )}
    </section>
  );
}
