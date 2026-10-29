'use client';
import type { Locale } from '@/lib/domain';
import { ActivityRail } from '@/features/care/activity-rail';
import { careKinds } from '@/features/care/activity-config';
import { useInsightsNavigation } from './navigation';
export function KindPicker({ locale }: { locale: Locale }) {
  const { selected, toggle, pending } = useInsightsNavigation();
  return (
    <ActivityRail
      locale={locale}
      label={locale === 'ko' ? '기능별 분석' : 'Analysis by activity'}
      className="insight-kind-rail"
      selected={selected}
      onSelect={(kind) => {
        if (kind !== 'gift' && kind !== 'allowance') toggle(kind);
      }}
      kinds={careKinds.filter(
        (kind) => kind !== 'gift' && kind !== 'allowance',
      )}
      multiple
      pending={pending}
    />
  );
}
