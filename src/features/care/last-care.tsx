'use client';
import { DiaperIcon } from '@/components/diaper-icon';
import { BreastIcon } from '@/components/breast-icon';
import { useEffect, useState } from 'react';
import { Milk, Utensils, Moon } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { Row } from '@/lib/db';
import { kindLabel } from '@/features/child-care/copy';
import { careDuration, careElapsed } from './last-care-model';
type Feed = Pick<
  Row<'care_records'>,
  'id' | 'kind' | 'started_at' | 'ended_at' | 'amount_ml' | 'amount_g'
>;
type Record = Pick<
  Row<'child_records'>,
  'id' | 'kind' | 'occurred_at' | 'ended_at'
>;
export function LastCare({
  locale,
  timezone,
  feeding,
  diaper,
  sleep,
  now: initialNow,
}: {
  locale: Locale;
  timezone: string;
  feeding: Feed | null;
  diaper: Record | null;
  sleep: Record | null;
  now: string;
}) {
  const [now, setNow] = useState(() => Date.parse(initialNow));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 30000);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, []);
  const ko = locale === 'ko';
  const running = (start: string) => {
    const minutes = Math.max(0, Math.floor((now - Date.parse(start)) / 60000));
    return minutes < 1
      ? ko
        ? '방금 시작'
        : 'Just started'
      : ko
        ? `${careDuration(minutes, locale)}째`
        : careDuration(minutes, locale);
  };
  const foodName =
    feeding?.kind === 'breast'
      ? ko
        ? '모유'
        : 'Breast'
      : feeding?.kind === 'solids'
        ? ko
          ? '이유식'
          : 'Solids'
        : ko
          ? '분유'
          : 'Formula';
  const amount =
    feeding?.amount_ml != null
      ? `${feeding.amount_ml} ml`
      : feeding?.amount_g != null
        ? `${feeding.amount_g} g`
        : '';
  const cards = [
    {
      key: 'diaper',
      label: ko ? '마지막 용변' : 'Last potty',
      color: 'diaper',
      icon: DiaperIcon,
      at: diaper?.occurred_at,
      value: diaper ? careElapsed(diaper.occurred_at, now, locale) : null,
      detail: diaper ? kindLabel(diaper.kind, locale) : '',
    },
    {
      key: 'feeding',
      label: ko ? '마지막 식사' : 'Last feed',
      color: feeding?.kind ?? 'formula',
      icon:
        feeding?.kind === 'breast'
          ? BreastIcon
          : feeding?.kind === 'solids'
            ? Utensils
            : Milk,
      at: feeding?.started_at,
      value: feeding
        ? feeding.ended_at
          ? careElapsed(feeding.started_at, now, locale)
          : running(feeding.started_at)
        : null,
      detail: feeding
        ? [foodName, feeding.ended_at ? amount : ko ? '수유 중' : 'In progress']
            .filter(Boolean)
            .join(' · ')
        : '',
    },
    {
      key: 'sleep',
      label: ko ? '마지막 수면' : 'Last sleep',
      color: 'sleep',
      icon: Moon,
      at: sleep?.ended_at ?? sleep?.occurred_at,
      value: sleep
        ? sleep.ended_at
          ? careElapsed(sleep.ended_at, now, locale)
          : running(sleep.occurred_at)
        : null,
      detail: sleep
        ? sleep.ended_at
          ? `${ko ? '기상' : 'Woke up'} · ${careDuration((Date.parse(sleep.ended_at) - Date.parse(sleep.occurred_at)) / 60000, locale)}`
          : ko
            ? '수면 중'
            : 'Sleeping'
        : '',
    },
  ];
  return (
    <section
      className="last-care"
      aria-label={ko ? '최근 돌봄 요약' : 'Latest care summary'}
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <article
            key={card.key}
            className={`last-care-card quick-color-${card.color}`}
            data-last-care={card.key}
          >
            <div className="last-care-heading">
              <span className="last-care-icon">
                <Icon size={18} />
              </span>
              <h2>{card.label}</h2>
            </div>
            {card.at ? (
              <time
                dateTime={new Date(card.at).toISOString()}
                title={new Intl.DateTimeFormat(locale, {
                  timeZone: timezone,
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(card.at))}
              >
                {card.value}
              </time>
            ) : (
              <strong className="last-care-empty">
                {ko ? '기록 없음' : 'No record'}
              </strong>
            )}
            {card.detail && <p>{card.detail}</p>}
          </article>
        );
      })}
    </section>
  );
}
