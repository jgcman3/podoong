import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { loadPushPreferences } from '@/features/notifications/settings';
import { ServiceGuide } from './guide';
export async function FirstUseGuide({
  context,
  locale,
  replay = false,
}: {
  context: CareContext;
  locale: Locale;
  replay?: boolean;
}) {
  if (context.profile.service_tour_completed_at && !replay) return null;
  return (
    <ServiceGuide
      locale={locale}
      preferences={await loadPushPreferences(context)}
    />
  );
}
