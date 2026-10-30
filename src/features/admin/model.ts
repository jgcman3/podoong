import { z } from 'zod';
import type { Locale } from '@/lib/domain';
export const requestStatuses = [
  'received',
  'reviewing',
  'in_progress',
  'done',
  'closed',
] as const;
export const requestPriorities = ['low', 'normal', 'high', 'urgent'] as const;
export const adminSections = [
  'dashboard',
  'requests',
  'analytics',
  'people',
  'neighborhoods',
  'operations',
  'audit',
] as const;
export type AdminSection = (typeof adminSections)[number];
export const errorSections = [
  'today',
  'calendar',
  'insights',
  'diary',
  'account',
  'admin',
  'other',
] as const;
export const errorCodes = [
  'render_failed',
  'record_save_failed',
  'photo_upload_failed',
  'request_failed',
] as const;
export const errorInput = z.object({
  id: z.uuid(),
  section: z.enum(errorSections),
  code: z.enum(errorCodes),
  digest: z
    .string()
    .regex(/^\d{1,20}$/)
    .nullable()
    .default(null),
});
export const cursorSchema = z.object({
  before: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export function adminCursor(query: { before?: string; id?: string }) {
  const parsed = cursorSchema.safeParse(query);
  return parsed.success
    ? { p_before: parsed.data.before, p_before_id: parsed.data.id }
    : {};
}
export function adminText(locale: Locale) {
  const ko = locale === 'ko';
  return {
    title: ko ? '포둥 운영' : 'podoong Operations',
    sections: ko
      ? {
          dashboard: '대시보드',
          requests: '개발 요청',
          analytics: '이용 분석',
          people: '사용자·가족',
          neighborhoods: '동네 현황',
          operations: '운영 상태',
          audit: '작업 이력',
        }
      : {
          dashboard: 'Dashboard',
          requests: 'Requests',
          analytics: 'Usage',
          people: 'Users & families',
          neighborhoods: 'Neighborhoods',
          operations: 'Operations',
          audit: 'Audit log',
        },
    statuses: ko
      ? {
          received: '접수',
          reviewing: '검토 중',
          in_progress: '개발 중',
          done: '완료',
          closed: '보류·종결',
        }
      : {
          received: 'Received',
          reviewing: 'Reviewing',
          in_progress: 'In progress',
          done: 'Done',
          closed: 'Closed',
        },
    priorities: ko
      ? { low: '낮음', normal: '보통', high: '높음', urgent: '긴급' }
      : { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' },
    categories: ko
      ? { feature: '기능 제안', bug: '오류 제보', other: '기타 의견' }
      : { feature: 'Feature', bug: 'Bug', other: 'Feedback' },
    all: ko ? '전체' : 'All',
    empty: ko ? '표시할 항목이 없어요.' : 'Nothing to show.',
    next: ko ? '다음 목록' : 'Next',
    first: ko ? '처음으로' : 'First',
    save: ko ? '변경 저장' : 'Save changes',
  };
}
export function adminDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}
const count = z.number().int().nonnegative();
export const dashboardSchema = z.object({
  users: count,
  families: count,
  children: count,
  new_users_7d: count,
  active_families_7d: count,
  steady_families_7d: count,
  collaborating_families_7d: count,
  records_7d: count,
  open_requests: count,
  unresolved_errors: count,
  failed_jobs: count,
  as_of: z.string(),
});
export const usageSchema = z.object({
  days: count,
  timezone: z.string(),
  daily: z.array(
    z.object({
      day: z.string(),
      signups: count,
      records: count,
      families: count,
    }),
  ),
  cohort: z.object({
    families: count,
    with_child: count,
    with_record: count,
    returned: count,
  }),
  features: z.array(z.object({ feature: z.string(), count })),
});
export const operationsSchema = z.object({
  photo_cleanup: count,
  push_devices: count,
  push_sent_24h: count,
  deletion_pending: count,
  push_configured: z.boolean(),
  push_schedule_active: z.boolean(),
  failed: z.array(
    z.object({
      source: z.string(),
      id: z.uuid(),
      at: z.string(),
      status: z.string(),
      attempts: count,
      error_code: z.string().nullable(),
    }),
  ),
});
