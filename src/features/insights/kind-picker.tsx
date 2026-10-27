'use client';
import type { Locale } from '@/lib/domain';
import { ActivityRail } from '@/features/care/activity-rail';
import { useInsightsNavigation } from './navigation';
export function KindPicker({ locale }: { locale: Locale }) {
  const { selected, toggle, pending } = useInsightsNavigation();
  return (
    <ActivityRail
      locale={locale}
      label={locale === 'ko' ? '기능별 분석' : 'Analysis by activity'}
      className="insight-kind-rail"
      selected={selected}
      onSelect={toggle}
      multiple
      pending={pending}
    />
  );
}
