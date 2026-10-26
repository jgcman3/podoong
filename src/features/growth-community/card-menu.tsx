'use client';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import {
  Ellipsis,
  ChartNoAxesCombined,
  Flag,
  X,
  Weight,
  Ruler,
  ScanFace,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { getGrowthHistory, reportGrowthDiary } from './card-actions';
type Measurement = Awaited<ReturnType<typeof getGrowthHistory>>['rows'][number];
export function DiaryCardMenu({
  child,
  record,
  nickname,
  locale,
}: {
  child: string;
  record: string;
  nickname: string;
  locale: Locale;
}) {
  const ko = locale === 'ko',
    titleId = useId();
  const menu = useRef<HTMLDetailsElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const generation = useRef(0);
  const [mode, setMode] = useState<'growth' | 'report' | null>(null);
  const [rows, setRows] = useState<Measurement[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false);
  const [error, setError] = useState(false),
    [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (mode) dialog.current?.showModal();
  }, [mode]);
  function load(index: number) {
    const current = ++generation.current;
    setError(false);
    startTransition(async () => {
      try {
        const data = await getGrowthHistory({
          child,
          record,
          locale,
          page: index,
        });
        if (current !== generation.current) return;
        if (!data.ok) {
          setError(true);
          return;
        }
        setRows((previous) =>
          index === 0 ? data.rows : [...previous, ...data.rows],
        );
        setMore(data.more);
        setPage(index);
      } catch {
        if (current === generation.current) setError(true);
      }
    });
  }
  function open(next: 'growth' | 'report') {
    if (menu.current) menu.current.open = false;
    setError(false);
    setSent(false);
    setRows([]);
    setMore(false);
    setPage(0);
    setMode(next);
    if (next === 'growth') load(0);
  }
  function close() {
    generation.current++;
    dialog.current?.close();
    setMode(null);
  }
  return (
    <div className="diary-card-menu">
      <details ref={menu}>
        <summary
          aria-label={
            ko ? `${nickname} 일기 더보기` : `More options for ${nickname}`
          }
        >
          <Ellipsis size={21} />
        </summary>
        <div className="diary-menu-options">
          <button type="button" onClick={() => open('growth')}>
            <ChartNoAxesCombined size={17} />
            {ko ? '성장 데이터 보기' : 'View growth data'}
          </button>
          <button type="button" onClick={() => open('report')}>
            <Flag size={17} />
            {ko ? '신고하기' : 'Report'}
          </button>
        </div>
      </details>
      <dialog
        ref={dialog}
        className="diary-data-dialog"
        aria-labelledby={titleId}
        onCancel={close}
        onClose={() => {
          generation.current++;
          setMode(null);
        }}
      >
        <div className="diary-dialog-heading">
          <h2 id={titleId}>
            {mode === 'growth'
              ? ko
                ? `${nickname} 성장 데이터`
                : `${nickname} · Growth data`
              : ko
                ? '신고하기'
                : 'Report diary'}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={ko ? '닫기' : 'Close'}
          >
            <X size={22} />
          </button>
        </div>
        {mode === 'growth' && (
          <>
            {rows.length > 0 && (
              <div className="diary-growth-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">D+</th>
                      {[
                        {
                          label: ko ? '몸무게' : 'Weight',
                          Icon: Weight,
                          unit: 'kg',
                        },
                        {
                          label: ko ? '키' : 'Height',
                          Icon: Ruler,
                          unit: 'cm',
                        },
                        {
                          label: ko ? '머리둘레' : 'Head circumference',
                          Icon: ScanFace,
                          unit: 'cm',
                        },
                      ].map(({ label, Icon, unit }) => (
                        <th scope="col" key={label}>
                          <span role="img" title={label} aria-label={label}>
                            <Icon size={17} aria-hidden="true" />
                          </span>
                          <small>{unit}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row">D+{row.age_days}</th>
                        <td>{row.weight_kg ?? '—'}</td>
                        <td>{row.height_cm ?? '—'}</td>
                        <td>{row.head_cm ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!pending && !error && rows.length === 0 && (
              <p className="diary-dialog-empty">
                {ko
                  ? '공개된 성장 측정 기록이 없어요.'
                  : 'No shared measurements yet.'}
              </p>
            )}
            {pending && <p role="status">{ko ? '불러오는 중…' : 'Loading…'}</p>}
            {more && !error && (
              <button
                className="button secondary"
                type="button"
                disabled={pending}
                onClick={() => load(page + 1)}
              >
                {ko ? '더 보기' : 'Load more'}
              </button>
            )}
            {error && (
              <>
                <p role="alert">
                  {ko
                    ? '성장 데이터를 불러오지 못했어요. 공개 상태를 확인해주세요.'
                    : 'Unable to load growth data. Check whether this diary is still shared.'}
                </p>
                <button
                  className="button secondary"
                  onClick={() => load(rows.length ? page + 1 : 0)}
                  disabled={pending}
                >
                  {ko ? '다시 시도' : 'Retry'}
                </button>
              </>
            )}
          </>
        )}
        {mode === 'report' &&
          (sent ? (
            <p role="status">
              {ko ? '신고를 접수했어요.' : 'Your report has been received.'}
            </p>
          ) : (
            <form
              className="form-stack"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                setError(false);
                const current = ++generation.current;
                startTransition(async () => {
                  try {
                    const ok = await reportGrowthDiary({
                      child,
                      record,
                      locale,
                      reason: String(form.get('reason')),
                      detail: String(form.get('detail') ?? ''),
                    });
                    if (current === generation.current) {
                      setSent(ok);
                      setError(!ok);
                    }
                  } catch {
                    if (current === generation.current) setError(true);
                  }
                });
              }}
            >
              <label>
                {ko ? '신고 사유' : 'Reason'}
                <select name="reason" defaultValue="" required>
                  <option value="" disabled>
                    {ko ? '선택해주세요' : 'Choose a reason'}
                  </option>
                  <option value="spam">
                    {ko ? '스팸·광고' : 'Spam or advertising'}
                  </option>
                  <option value="inappropriate">
                    {ko ? '부적절한 내용' : 'Inappropriate content'}
                  </option>
                  <option value="privacy">
                    {ko ? '개인정보 노출' : 'Personal information exposed'}
                  </option>
                  <option value="other">{ko ? '기타' : 'Other'}</option>
                </select>
              </label>
              <label>
                {ko ? '추가 내용 (선택)' : 'Additional details (optional)'}
                <textarea name="detail" maxLength={400} />
              </label>
              {error && (
                <p role="alert">
                  {ko
                    ? '신고를 접수하지 못했어요. 다시 시도해주세요.'
                    : 'Unable to submit. Please try again.'}
                </p>
              )}
              <button className="button primary" disabled={pending}>
                {pending
                  ? ko
                    ? '접수 중…'
                    : 'Submitting…'
                  : ko
                    ? '신고 접수'
                    : 'Submit report'}
              </button>
            </form>
          ))}
      </dialog>
    </div>
  );
}
