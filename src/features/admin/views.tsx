import Link from 'next/link';
import {
  ArrowUpRight,
  Users,
  TriangleAlert,
  CheckCircle2,
  MessageSquareText,
  Activity,
} from 'lucide-react';
import { requireAdmin } from './auth';
import {
  adminCursor,
  adminDate,
  adminText,
  dashboardSchema,
  operationsSchema,
  usageSchema,
  requestStatuses,
  type AdminSection,
} from './model';
import { RequestEditor } from './request-editor';
import { resolveAdminError } from './actions';
import type { Locale } from '@/lib/domain';
import type { Database } from '@/lib/database.types';
export type AdminQuery = {
  status?: string;
  category?: string;
  before?: string;
  id?: string;
  days?: string;
  view?: string;
  errors?: string;
};
function Empty({ locale }: { locale: Locale }) {
  return <p className="admin-empty">{adminText(locale).empty}</p>;
}
function Metric({
  title,
  value,
  detail,
}: {
  title: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="admin-metric">
      <span>{title}</span>
      <strong>{new Intl.NumberFormat().format(value)}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-table-scroll">
      <table className="admin-table">{children}</table>
    </div>
  );
}
function PageLinks({
  locale,
  section,
  query,
  rows,
  hasMore,
}: {
  locale: Locale;
  section: AdminSection;
  query: AdminQuery;
  rows: { id: string; created_at: string }[];
  hasMore: boolean;
}) {
  const copy = adminText(locale),
    last = rows.at(-1),
    params = new URLSearchParams();
  for (const key of ['status', 'category', 'view', 'errors'] as const)
    if (query[key]) params.set(key, query[key]!);
  const base = `/${locale}/admin/${section}`,
    first = params.toString();
  if (last) {
    params.set('before', last.created_at);
    params.set('id', last.id);
  }
  return (
    <nav
      className="admin-pagination"
      aria-label={locale === 'ko' ? '목록 이동' : 'Pagination'}
    >
      {query.before && (
        <Link href={`${base}${first ? `?${first}` : ''}`}>{copy.first}</Link>
      )}
      {hasMore && last && (
        <Link href={`${base}?${params.toString()}`}>
          {copy.next}
          <ArrowUpRight size={15} />
        </Link>
      )}
    </nav>
  );
}
export async function AdminView({
  locale,
  section,
  query,
}: {
  locale: Locale;
  section: AdminSection;
  query: AdminQuery;
}) {
  const { db } = await requireAdmin(locale),
    copy = adminText(locale),
    ko = locale === 'ko';
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">podoong / OPERATIONS</span>
          <h1>{copy.sections[section]}</h1>
        </div>
        <small>
          {ko
            ? '시간 기준 · 한국 표준시'
            : 'Times shown in Korea Standard Time'}
        </small>
      </div>
      {await (async () => {
        if (section === 'dashboard') {
          const result = await db.rpc('admin_dashboard');
          if (result.error) throw new Error('Admin dashboard unavailable');
          const data = dashboardSchema.parse(result.data);
          return (
            <>
              <section className="admin-hero">
                <span className="admin-hero-icon">
                  <Users size={25} />
                </span>
                <div>
                  <p>
                    {ko
                      ? '꾸준히 기록하는 가족'
                      : 'Families building a routine'}
                  </p>
                  <strong>
                    {data.steady_families_7d}
                    <small>{ko ? '가족' : 'families'}</small>
                  </strong>
                  <span>
                    {ko
                      ? '최근 7일 동안 3일 이상 기록한 가족'
                      : 'Recorded on at least three days in the past seven days'}
                  </span>
                </div>
                <Link href={`/${locale}/admin/analytics`}>
                  {ko ? '이용 분석' : 'Explore usage'}
                  <ArrowUpRight size={18} />
                </Link>
              </section>
              <div className="admin-metrics">
                <Metric
                  title={ko ? '활동 가족 · 7일' : 'Active families · 7d'}
                  value={data.active_families_7d}
                />
                <Metric
                  title={
                    ko
                      ? '함께 기록한 가족 · 7일'
                      : 'Collaborating families · 7d'
                  }
                  value={data.collaborating_families_7d}
                  detail={
                    ko
                      ? '보호자 2명 이상이 기록'
                      : 'At least two caregivers recorded'
                  }
                />
                <Metric
                  title={ko ? '등록 기록 · 7일' : 'Records created · 7d'}
                  value={data.records_7d}
                />
                <Metric
                  title={ko ? '신규 사용자 · 7일' : 'New users · 7d'}
                  value={data.new_users_7d}
                />
              </div>
              <section className="admin-panel">
                <h2>{ko ? '지금 확인할 일' : 'Needs attention'}</h2>
                <div className="admin-attention">
                  <Link href={`/${locale}/admin/requests`}>
                    <MessageSquareText size={21} />
                    <span>{ko ? '진행할 개발 요청' : 'Open requests'}</span>
                    <strong>{data.open_requests}</strong>
                    <ArrowUpRight size={17} />
                  </Link>
                  <Link href={`/${locale}/admin/operations`}>
                    <TriangleAlert size={21} />
                    <span>
                      {ko ? '미해결 서비스 오류' : 'Unresolved errors'}
                    </span>
                    <strong>{data.unresolved_errors}</strong>
                    <ArrowUpRight size={17} />
                  </Link>
                  <Link href={`/${locale}/admin/operations`}>
                    <Activity size={21} />
                    <span>{ko ? '실패한 작업' : 'Failed jobs'}</span>
                    <strong>{data.failed_jobs}</strong>
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
              </section>
              <section className="admin-panel">
                <h2>{ko ? '서비스 규모' : 'Service overview'}</h2>
                <div className="admin-metrics compact">
                  <Metric title={ko ? '사용자' : 'Users'} value={data.users} />
                  <Metric
                    title={ko ? '가족' : 'Families'}
                    value={data.families}
                  />
                  <Metric
                    title={ko ? '아이' : 'Children'}
                    value={data.children}
                  />
                </div>
                <p className="admin-caption">
                  {ko ? '마지막 조회' : 'Updated'} ·{' '}
                  {adminDate(data.as_of, locale)}
                </p>
              </section>
            </>
          );
        }
        if (section === 'requests') {
          const status = requestStatuses.includes(
              query.status as (typeof requestStatuses)[number],
            )
              ? query.status!
              : '',
            category = ['feature', 'bug', 'other'].includes(
              query.category ?? '',
            )
              ? query.category!
              : '';
          const result = await db.rpc('admin_requests', {
            p_status: status,
            p_category: category,
            ...adminCursor(query),
          });
          if (result.error) throw new Error('Admin requests unavailable');
          const rows = result.data.slice(0, 30);
          return (
            <>
              <form className="admin-filters" method="get">
                <label>
                  {ko ? '처리 상태' : 'Status'}
                  <select name="status" defaultValue={status}>
                    <option value="">{copy.all}</option>
                    {requestStatuses.map((value) => (
                      <option key={value} value={value}>
                        {copy.statuses[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {ko ? '요청 종류' : 'Category'}
                  <select name="category" defaultValue={category}>
                    <option value="">{copy.all}</option>
                    {Object.entries(copy.categories).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button secondary">
                  {ko ? '조회' : 'Apply'}
                </button>
              </form>
              <div className="admin-request-list">
                {rows.length ? (
                  rows.map((row) => (
                    <article
                      className="admin-panel admin-request-card"
                      key={`${row.id}:${row.version}`}
                    >
                      <header>
                        <span
                          className={`admin-badge priority-${row.priority}`}
                        >
                          {
                            copy.priorities[
                              row.priority as keyof typeof copy.priorities
                            ]
                          }
                        </span>
                        <span className="admin-badge">
                          {
                            copy.categories[
                              row.category as keyof typeof copy.categories
                            ]
                          }
                        </span>
                        <span className="admin-request-state">
                          {
                            copy.statuses[
                              row.status as keyof typeof copy.statuses
                            ]
                          }
                        </span>
                        <time>{adminDate(row.created_at, locale)}</time>
                      </header>
                      <p className="admin-request-body">{row.body}</p>
                      <div className="admin-request-byline">
                        {row.display_name || (ko ? '사용자' : 'User')}{' '}
                        <code>{row.user_id.slice(0, 8)}</code>
                      </div>
                      <details>
                        <summary>
                          {ko
                            ? '처리 상태·메모 관리'
                            : 'Manage status and notes'}
                        </summary>
                        <RequestEditor
                          locale={locale}
                          id={row.id}
                          status={row.status}
                          priority={row.priority}
                          note={row.internal_note}
                          version={row.version}
                        />
                      </details>
                    </article>
                  ))
                ) : (
                  <Empty locale={locale} />
                )}
              </div>
              <PageLinks
                locale={locale}
                section={section}
                query={{ ...query, status, category }}
                rows={rows}
                hasMore={result.data.length > 30}
              />
            </>
          );
        }
        if (section === 'analytics') {
          const days = [7, 14, 28].includes(Number(query.days))
              ? Number(query.days)
              : 14,
            result = await db.rpc('admin_usage', { p_days: days });
          if (result.error) throw new Error('Admin analytics unavailable');
          const data = usageSchema.parse(result.data),
            max = Math.max(1, ...data.daily.map((day) => day.records));
          const stages = [
            [ko ? '새 가족' : 'New families', data.cohort.families],
            [ko ? '아이 등록' : 'Added child', data.cohort.with_child],
            [ko ? '첫 기록' : 'First record', data.cohort.with_record],
            [ko ? '다른 날 재사용' : 'Used another day', data.cohort.returned],
          ] as const;
          return (
            <>
              <div
                className="admin-period"
                role="group"
                aria-label={ko ? '분석 기간' : 'Period'}
              >
                {[7, 14, 28].map((value) => (
                  <Link
                    key={value}
                    href={`/${locale}/admin/analytics?days=${value}`}
                    aria-current={days === value ? 'page' : undefined}
                  >
                    {value}
                    {ko ? '일' : ' days'}
                  </Link>
                ))}
              </div>
              <section className="admin-panel">
                <h2>{ko ? '일별 기록 생성' : 'Records created per day'}</h2>
                <div className="admin-chart-scroll">
                  <div
                    className="admin-bar-chart"
                    role="img"
                    aria-label={
                      ko
                        ? `최근 ${days}일 기록 생성 수`
                        : `Records created over ${days} days`
                    }
                  >
                    {data.daily.map((day) => (
                      <div key={day.day} className="admin-chart-column">
                        <span>{day.records}</span>
                        <div className="admin-bar-track">
                          <i
                            style={{ height: `${(day.records / max) * 100}%` }}
                          />
                        </div>
                        <small>{day.day.slice(5).replace('-', '/')}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              <section className="admin-panel">
                <h2>
                  {ko
                    ? '최근 28일 신규 가족의 이용 흐름'
                    : 'New-family journey · past 28 days'}
                </h2>
                <div className="admin-funnel">
                  {stages.map(([label, value], index) => (
                    <div key={label}>
                      <span>
                        {index + 1}. {label}
                      </span>
                      <strong>{value}</strong>
                      <small>
                        {data.cohort.families
                          ? `${Math.round((value / data.cohort.families) * 100)}%`
                          : '—'}
                      </small>
                    </div>
                  ))}
                </div>
                <p className="admin-caption">
                  {ko
                    ? '현재 보관 중인 기록의 생성일 기준입니다. 재사용은 서로 다른 날짜에 기록한 가족을 집계합니다.'
                    : 'Based on creation dates of retained records. Return use means recording on different dates.'}
                </p>
              </section>
              <section className="admin-panel">
                <h2>{ko ? '일별 집계' : 'Daily totals'}</h2>
                <Table>
                  <thead>
                    <tr>
                      {[
                        ko ? '날짜' : 'Date',
                        ko ? '가입' : 'Signups',
                        ko ? '활동 가족' : 'Active families',
                        ko ? '등록 기록' : 'Records',
                      ].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((day) => (
                      <tr key={day.day}>
                        <td>{day.day}</td>
                        <td>{day.signups}</td>
                        <td>{day.families}</td>
                        <td>{day.records}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </section>
              <section className="admin-panel">
                <h2>{ko ? '기록 유형별 이용' : 'Record categories'}</h2>
                {data.features.length ? (
                  <ul className="admin-simple-list">
                    {data.features.map((row) => (
                      <li key={row.feature}>
                        <span>
                          {(
                            {
                              feeding: ko ? '먹이기' : 'Feeding',
                              sleep: ko ? '수면' : 'Sleep',
                              diaper: ko ? '용변' : 'Diaper / bowel',
                              diary: ko ? '성장 기록' : 'Growth diary',
                              activity: ko ? '기타 돌봄' : 'Other care',
                            } as Record<string, string>
                          )[row.feature] ?? row.feature}
                        </span>
                        <strong>{row.count}</strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty locale={locale} />
                )}
              </section>
            </>
          );
        }
        if (section === 'people') {
          const families = query.view === 'families';
          const result = families
            ? await db.rpc('admin_families', adminCursor(query))
            : await db.rpc('admin_users', adminCursor(query));
          if (result.error) throw new Error('Admin accounts unavailable');
          return (
            <>
              <div className="admin-period">
                <Link
                  href={`/${locale}/admin/people`}
                  aria-current={!families ? 'page' : undefined}
                >
                  {ko ? '사용자' : 'Users'}
                </Link>
                <Link
                  href={`/${locale}/admin/people?view=families`}
                  aria-current={families ? 'page' : undefined}
                >
                  {ko ? '가족' : 'Families'}
                </Link>
              </div>
              <section className="admin-panel">
                {families ? (
                  <FamilyRows
                    rows={result.data as AdminRows<'admin_families'>}
                    locale={locale}
                  />
                ) : (
                  <UserRows
                    rows={result.data as AdminRows<'admin_users'>}
                    locale={locale}
                  />
                )}
              </section>
              <PageLinks
                locale={locale}
                section={section}
                query={query}
                rows={result.data.slice(0, 30)}
                hasMore={result.data.length > 30}
              />
            </>
          );
        }
        if (section === 'neighborhoods') {
          const result = await db.rpc('admin_neighborhoods');
          if (result.error) throw new Error('Admin neighborhoods unavailable');
          return (
            <section className="admin-panel">
              <h2>{ko ? '지역별 가족 현황' : 'Families by area'}</h2>
              {result.data.length ? (
                <Table>
                  <thead>
                    <tr>
                      <th>{ko ? '지역 구분' : 'Region'}</th>
                      <th>{ko ? '거주 가족' : 'Families'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row) => (
                      <tr key={row.region}>
                        <td className="admin-wrap">{row.region}</td>
                        <td>{row.families}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty locale={locale} />
              )}
              <p className="admin-caption">
                {ko
                  ? '한 가족은 지역별로 한 번 집계합니다. 최대 100개 지역을 표시합니다.'
                  : 'Each family counts once per region. Up to 100 regions are shown.'}
              </p>
            </section>
          );
        }
        if (section === 'operations') {
          const [result, errors] = await Promise.all([
            db.rpc('admin_operations'),
            db.rpc('admin_errors', {
              p_open_only: query.errors !== 'all',
              ...adminCursor(query),
            }),
          ]);
          if (result.error || errors.error)
            throw new Error('Admin operations unavailable');
          const data = operationsSchema.parse(result.data),
            rows = errors.data.slice(0, 30);
          return (
            <>
              <div className="admin-metrics">
                <Metric
                  title={ko ? '푸시 등록 기기' : 'Push devices'}
                  value={data.push_devices}
                />
                <Metric
                  title={ko ? '발송 성공 · 24시간' : 'Push sent · 24h'}
                  value={data.push_sent_24h}
                />
                <Metric
                  title={ko ? '사진 정리 대기' : 'Photo cleanup queued'}
                  value={data.photo_cleanup}
                />
                <Metric
                  title={ko ? '탈퇴 처리 대기' : 'Account deletion queued'}
                  value={data.deletion_pending}
                />
              </div>
              <section className="admin-panel">
                <h2>
                  {ko ? '식사 알림 설정' : 'Feeding notification configuration'}
                </h2>
                <div className="admin-status-row">
                  <CheckCircle2 size={18} />
                  <span>{ko ? '발송 키 설정' : 'Sending key configured'}</span>
                  <strong>
                    {data.push_configured
                      ? ko
                        ? '등록됨'
                        : 'Configured'
                      : ko
                        ? '미설정'
                        : 'Not configured'}
                  </strong>
                </div>
                <div className="admin-status-row">
                  <Activity size={18} />
                  <span>{ko ? '매분 예약 작업' : 'Every-minute schedule'}</span>
                  <strong>
                    {data.push_schedule_active
                      ? ko
                        ? '활성'
                        : 'Active'
                      : ko
                        ? '미등록'
                        : 'Not configured'}
                  </strong>
                </div>
              </section>
              <section className="admin-panel">
                <h2>{ko ? '실패한 서버 작업' : 'Failed server jobs'}</h2>
                {data.failed.length ? (
                  <Table>
                    <thead>
                      <tr>
                        {[
                          ko ? '종류' : 'Type',
                          ko ? '작업 ID' : 'Job ID',
                          ko ? '시각' : 'Time',
                          ko ? '시도' : 'Attempts',
                          ko ? '오류 코드' : 'Error code',
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.failed.map((row) => (
                        <tr key={`${row.source}:${row.id}`}>
                          <td>
                            {
                              (
                                {
                                  deletion: ko ? '탈퇴 처리' : 'Deletion',
                                  feeding_push: ko
                                    ? '식사 푸시'
                                    : 'Feeding push',
                                  inbox: ko ? '앱 알림' : 'Inbox',
                                } as Record<string, string>
                              )[row.source]
                            }
                          </td>
                          <td>
                            <code title={row.id}>{row.id.slice(0, 8)}</code>
                          </td>
                          <td>{adminDate(row.at, locale)}</td>
                          <td>{row.attempts}</td>
                          <td>
                            <code>{row.error_code || '—'}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Empty locale={locale} />
                )}
                <p className="admin-caption">
                  {ko
                    ? '최근 실패 50건입니다. 삭제·실제 알림 발송은 이 화면에서 자동 실행하지 않습니다.'
                    : 'Latest 50 failures. This page does not automatically delete data or send notifications.'}
                </p>
              </section>
              <section className="admin-panel">
                <div className="admin-panel-heading">
                  <h2>{ko ? '서비스 화면 오류' : 'Application errors'}</h2>
                  <Link
                    href={`/${locale}/admin/operations?errors=${query.errors === 'all' ? 'open' : 'all'}`}
                  >
                    {query.errors === 'all'
                      ? ko
                        ? '미해결만'
                        : 'Unresolved only'
                      : ko
                        ? '해결 포함'
                        : 'Include resolved'}
                  </Link>
                </div>
                {rows.length ? (
                  <Table>
                    <thead>
                      <tr>
                        {[
                          ko ? '화면' : 'Page',
                          ko ? '코드' : 'Code',
                          ko ? '오류 ID' : 'Digest',
                          ko ? '발생 시각' : 'Time',
                          ko ? '처리' : 'Action',
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.section}</td>
                          <td>
                            <code>{row.code}</code>
                          </td>
                          <td>
                            <code>{row.digest || '—'}</code>
                          </td>
                          <td>{adminDate(row.created_at, locale)}</td>
                          <td>
                            {row.resolved_at ? (
                              <span className="admin-badge">
                                {ko ? '해결' : 'Resolved'}
                              </span>
                            ) : (
                              <form action={resolveAdminError}>
                                <input
                                  type="hidden"
                                  name="locale"
                                  value={locale}
                                />
                                <input type="hidden" name="id" value={row.id} />
                                <button className="button secondary">
                                  {ko ? '해결 표시' : 'Mark resolved'}
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Empty locale={locale} />
                )}
                <p className="admin-caption">
                  {ko
                    ? '오류 코드와 화면 구분만 수집합니다. 일기 본문·사진·공유 토큰·입력값은 수집하지 않습니다.'
                    : 'Only error codes and page categories are collected, without diary content, photos, shared tokens or input values.'}
                </p>
                <PageLinks
                  locale={locale}
                  section={section}
                  query={query}
                  rows={rows}
                  hasMore={errors.data.length > 30}
                />
              </section>
            </>
          );
        }
        const result = await db.rpc('admin_audit', adminCursor(query));
        if (result.error) throw new Error('Admin audit unavailable');
        const rows = result.data.slice(0, 30);
        return (
          <section className="admin-panel">
            {rows.length ? (
              <Table>
                <thead>
                  <tr>
                    {[
                      ko ? '시각' : 'Time',
                      ko ? '운영자' : 'Operator',
                      ko ? '작업' : 'Action',
                      ko ? '대상 ID' : 'Target ID',
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{adminDate(row.created_at, locale)}</td>
                      <td>
                        {row.actor_name || (ko ? '운영 DB' : 'Operations DB')}
                      </td>
                      <td>
                        {(
                          {
                            request_update: ko
                              ? '개발 요청 변경'
                              : 'Request updated',
                            error_resolve: ko
                              ? '오류 해결 표시'
                              : 'Error marked resolved',
                            admin_grant: ko ? '관리자 지정' : 'Admin granted',
                            admin_change: ko ? '관리자 변경' : 'Admin changed',
                            admin_revoke: ko ? '관리자 해제' : 'Admin revoked',
                          } as Record<string, string>
                        )[row.action] ?? row.action}
                      </td>
                      <td>
                        <code title={row.subject_id}>
                          {row.subject_id.slice(0, 8)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Empty locale={locale} />
            )}
            <PageLinks
              locale={locale}
              section={section}
              query={query}
              rows={rows}
              hasMore={result.data.length > 30}
            />
          </section>
        );
      })()}
    </>
  );
}
type AdminRows<K extends keyof Database['public']['Functions']> =
  Database['public']['Functions'][K]['Returns'];
function UserRows({
  rows,
  locale,
}: {
  rows: AdminRows<'admin_users'> | null;
  locale: Locale;
}) {
  const ko = locale === 'ko';
  return rows?.length ? (
    <Table>
      <thead>
        <tr>
          {[
            ko ? '사용자' : 'User',
            ko ? '계정 ID' : 'Account ID',
            ko ? '가입일' : 'Joined',
            ko ? '가족' : 'Families',
            ko ? '상태' : 'Status',
          ].map((label) => (
            <th key={label}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 30).map((row) => (
          <tr key={row.id}>
            <td>{row.display_name || '—'}</td>
            <td>
              <code title={row.id}>{row.id.slice(0, 8)}</code>
            </td>
            <td>{adminDate(row.created_at, locale)}</td>
            <td>{row.family_count}</td>
            <td>
              <span className="admin-badge">
                {row.deletion_requested
                  ? ko
                    ? '탈퇴 처리 중'
                    : 'Deletion requested'
                  : row.is_admin
                    ? ko
                      ? '서비스 관리자'
                      : 'Service admin'
                    : ko
                      ? '이용 중'
                      : 'Active'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  ) : (
    <Empty locale={locale} />
  );
}
function FamilyRows({
  rows,
  locale,
}: {
  rows: AdminRows<'admin_families'> | null;
  locale: Locale;
}) {
  const ko = locale === 'ko';
  return rows?.length ? (
    <Table>
      <thead>
        <tr>
          {[
            ko ? '가족' : 'Family',
            ko ? '국가' : 'Country',
            ko ? '보호자' : 'Caregivers',
            ko ? '아이' : 'Children',
            ko ? '등록일' : 'Created',
          ].map((label) => (
            <th key={label}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 30).map((row) => (
          <tr key={row.id}>
            <td>
              {row.name}
              <small className="admin-row-id">{row.id.slice(0, 8)}</small>
            </td>
            <td>{row.country || '—'}</td>
            <td>{row.caregivers}</td>
            <td>{row.children}</td>
            <td>{adminDate(row.created_at, locale)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  ) : (
    <Empty locale={locale} />
  );
}
