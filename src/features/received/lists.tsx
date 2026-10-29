'use client';
import Image from 'next/image';
import { useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { careIcons } from '@/features/care/activity-config';
import type { Locale } from '@/lib/domain';
import type { ReceivedKind, ReceivedPage, ReceivedOverview } from './data';
import { moreReceivedRecords } from './actions';
import { receivedMoney } from './model';

export function ReceivedLists({
  childId,
  locale,
  gifts,
  allowance,
  overview,
}: {
  childId: string;
  locale: Locale;
  gifts: ReceivedPage;
  allowance: ReceivedPage;
  overview: ReceivedOverview;
}) {
  const ko = locale === 'ko',
    Gift = careIcons.gift,
    Wallet = careIcons.allowance;
  const title = ko ? '받은 선물' : 'Gifts received',
    cashTitle = ko ? '받은 용돈' : 'Allowance received';
  const totals = overview.allowance.filter((r) => r.is_total),
    senders = overview.allowance.filter((r) => !r.is_total);
  return (
    <div className="received-lists">
      <section
        className="panel received-list quick-color-gift"
        aria-label={title}
      >
        <h2>
          <span className="received-list-icon">
            <Gift size={19} />
          </span>
          {title}
        </h2>
        {overview.gifts.length ? (
          overview.gifts.map((group, i) => (
            <ReceivedHistory
              key={group.sender_name}
              childId={childId}
              locale={locale}
              kind="gift"
              sender={group.sender_name}
              totalCount={group.total_count}
              initial={i === 0 ? gifts : undefined}
            />
          ))
        ) : (
          <Empty locale={locale} kind="gift" />
        )}
      </section>
      <section
        className="panel received-list quick-color-allowance"
        aria-label={cashTitle}
      >
        <h2>
          <span className="received-list-icon">
            <Wallet size={19} />
          </span>
          {cashTitle}
        </h2>
        {totals.length ? (
          <>
            <div
              className="allowance-total"
              aria-label={ko ? '용돈 총금액' : 'Total allowance'}
            >
              <span>{ko ? '총 받은 금액' : 'Total received'}</span>
              {totals.map((row) => (
                <strong key={row.currency}>
                  {receivedMoney(row.total_amount, row.currency, locale)}
                </strong>
              ))}
            </div>
            <h3 className="received-subtitle">
              {ko ? '준 사람별' : 'By giver'}
            </h3>
            <ul className="allowance-senders">
              {Array.from(new Set(senders.map((r) => r.sender_name))).map(
                (name) => (
                  <li key={name}>
                    <strong>{name}</strong>
                    <span>
                      {senders
                        .filter((r) => r.sender_name === name)
                        .map((row) => (
                          <span key={row.currency}>
                            {receivedMoney(
                              row.total_amount,
                              row.currency,
                              locale,
                            )}
                          </span>
                        ))}
                    </span>
                  </li>
                ),
              )}
            </ul>
            <details className="allowance-history">
              <summary>
                {ko ? '받은 내역' : 'Received history'}
                <ChevronDown size={16} />
              </summary>
              <ReceivedHistory
                childId={childId}
                locale={locale}
                kind="allowance"
                initial={allowance}
              />
            </details>
          </>
        ) : (
          <Empty locale={locale} kind="allowance" />
        )}
      </section>
    </div>
  );
}
function Empty({ locale, kind }: { locale: Locale; kind: ReceivedKind }) {
  const Icon = careIcons[kind],
    ko = locale === 'ko';
  return (
    <div className="received-empty">
      <Icon size={28} />
      <p>
        {ko
          ? `아직 받은 ${kind === 'gift' ? '선물' : '용돈'} 기록이 없어요.`
          : `No ${kind === 'gift' ? 'gifts' : 'allowance'} recorded yet.`}
      </p>
    </div>
  );
}
function ReceivedHistory({
  childId,
  locale,
  kind,
  sender,
  initial,
  totalCount,
}: {
  childId: string;
  locale: Locale;
  kind: ReceivedKind;
  sender?: string;
  initial?: ReceivedPage;
  totalCount?: number;
}) {
  const [page, setPage] = useState(initial),
    [pending, start] = useTransition(),
    [failed, setFailed] = useState(false);
  const ko = locale === 'ko',
    gift = kind === 'gift',
    Icon = careIcons[kind];
  function load() {
    start(async () => {
      setFailed(false);
      const last = page?.items.at(-1);
      try {
        const next = await moreReceivedRecords({
          locale,
          childId,
          kind,
          sender,
          cursor: last ? { at: last.occurred_at, id: last.id } : undefined,
        });
        setPage((current) => ({
          items: [...(current?.items ?? []), ...next.items],
          hasMore: next.hasMore,
        }));
      } catch {
        setFailed(true);
      }
    });
  }
  const body = (
    <div className="received-history">
      {page && (
        <ul>
          {page.items.map((item) => (
            <li key={item.id}>
              {gift && item.child_record_photos[0] ? (
                <a
                  className="gift-photo-link"
                  href={`/api/care/photos/${item.child_record_photos[0].id}?size=1600`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={
                    ko ? `${item.title} 사진 보기` : `View ${item.title} photo`
                  }
                >
                  <Image
                    unoptimized
                    loading="lazy"
                    src={`/api/care/photos/${item.child_record_photos[0].id}?size=480`}
                    width={64}
                    height={64}
                    alt={item.title}
                  />
                </a>
              ) : (
                <span className="received-row-icon">
                  <Icon size={18} />
                </span>
              )}
              <div className="received-row-copy">
                <strong>
                  {gift
                    ? item.title
                    : receivedMoney(
                        item.received_amount!,
                        item.received_currency!,
                        locale,
                      )}
                </strong>
                {!gift && <span>{item.sender_name}</span>}
              </div>
              <time dateTime={item.occurred_at}>
                {new Intl.DateTimeFormat(locale, {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  timeZone: item.record_timezone,
                }).format(new Date(item.occurred_at))}
              </time>
            </li>
          ))}
        </ul>
      )}
      {failed && (
        <p role="alert" className="small">
          {ko
            ? '목록을 불러오지 못했어요. 다시 시도해 주세요.'
            : 'Could not load records. Please try again.'}
        </p>
      )}
      {(!page || page.hasMore) && (
        <button
          className="button secondary received-more"
          disabled={pending}
          onClick={load}
        >
          <ChevronDown size={16} />
          {pending
            ? ko
              ? '불러오는 중'
              : 'Loading'
            : page
              ? ko
                ? '더 보기'
                : 'More'
              : ko
                ? '선물 보기'
                : 'View gifts'}
        </button>
      )}
    </div>
  );
  return gift ? (
    <details
      className="gift-sender-group"
      open={initial !== undefined}
      onToggle={(event) => {
        if (event.currentTarget.open && !page && !pending) load();
      }}
    >
      <summary>
        <strong>{sender}</strong>
        <span>
          {totalCount}
          {ko ? '개' : ' gifts'}
        </span>
        <ChevronDown size={16} />
      </summary>
      {body}
    </details>
  ) : (
    body
  );
}
