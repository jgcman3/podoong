'use client';
import { DiaperIcon } from '@/components/diaper-icon';
import { BreastIcon } from '@/components/breast-icon';
import { useEffect, useState, type ReactNode } from 'react';
import { Milk, Utensils, Moon, MessageCircle } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { Row } from '@/lib/db';
import { kindLabel } from '@/features/child-care/copy';
import { careDuration, careElapsed } from './last-care-model';
import { relationshipLabel } from '@/features/family/relationship';
type Feed = Pick<
  Row<'care_records'>,
  | 'id'
  | 'kind'
  | 'started_at'
  | 'ended_at'
  | 'amount_ml'
  | 'timer_started'
  | 'created_by'
  | 'note'
>;
type Record = Pick<
  Row<'child_records'>,
  'id' | 'kind' | 'occurred_at' | 'ended_at' | 'created_by' | 'note'
>;
export function LastCare({
  locale,
  feeding,
  diaper,
  sleep,
  now: initialNow,
  caregivers,
  inviteAction,
  childPicker,
}: {
  locale: Locale;
  feeding: Feed | null;
  diaper: Record | null;
  sleep: Record | null;
  now: string;
  caregivers: { id: string; relationship?: string | null }[];
  inviteAction?: ReactNode;
  childPicker?: ReactNode;
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
  const amount = feeding?.amount_ml != null ? `${feeding.amount_ml} ml` : '';
  const feedingRunning =
    !!feeding &&
    !feeding.ended_at &&
    (feeding.kind === 'breast' || feeding.timer_started);
  const sleepRunning = !!sleep && !sleep.ended_at;
  const recorder = (id: string | null | undefined) => {
    const caregiver = caregivers.find((person) => person.id === id);
    return caregiver?.relationship
      ? relationshipLabel(caregiver.relationship, locale)
      : ko ? '가족' : 'Family';
  };
  const cards = [
    {
      key: 'diaper',
      label: ko ? '마지막 용변' : 'Last potty',
      color: 'diaper',
      icon: DiaperIcon,
      at: diaper?.occurred_at,
      value: diaper ? careElapsed(diaper.occurred_at, now, locale) : null,
      detail: diaper ? kindLabel(diaper.kind, locale) : '',
      record: diaper,
      ongoing: false,
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
        ? !feedingRunning
          ? careElapsed(feeding.started_at, now, locale)
          : running(feeding.started_at)
        : null,
      detail: feeding
        ? [foodName, feedingRunning ? (ko ? '수유 중' : 'In progress') : amount]
            .filter(Boolean)
            .join(' · ')
        : '',
      record: feeding,
      ongoing: feedingRunning,
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
      record: sleep,
      ongoing: sleepRunning,
    },
  ];
  return (
    <section
      className="care-handoff"
      aria-label={ko ? '최근 돌봄 요약' : 'Latest care summary'}
    >
      <header className="care-handoff-heading">
        {childPicker && (
          <div className="care-handoff-child-picker">{childPicker}</div>
        )}
        {inviteAction ?? (
          <span>{ko ? '함께 보는 돌봄 기록' : 'Shared with your family'}</span>
        )}
      </header>
      <div className="last-care">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.key}
              className={`last-care-card quick-color-${card.color}${card.ongoing ? ' is-ongoing' : ''}`}
              data-last-care={card.key}
            >
              <div className="last-care-heading">
                <span className="last-care-icon">
                  <Icon size={18} />
                </span>
                <h3>{card.label}</h3>
                {card.ongoing && (
                  <span
                    className="last-care-live"
                    aria-label={ko ? '진행 중' : 'In progress'}
                  />
                )}
              </div>
              {card.at ? (
                <time dateTime={new Date(card.at).toISOString()}>
                  {card.value}
                </time>
              ) : (
                <strong className="last-care-empty">
                  {ko ? '기록 없음' : 'No record'}
                </strong>
              )}
              {card.at && (
                <div className="last-care-detail">
                  <span>{card.detail}</span>
                  <span className="last-care-recorder" title={recorder(card.record?.created_by)}>
                    {recorder(card.record?.created_by)}
                  </span>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {cards.some((card) => card.record?.note.trim()) && (
        <div className="care-handoff-notes">
          <h3>
            <MessageCircle size={14} aria-hidden="true" />
            {ko ? '기록에 남긴 메모' : 'Notes from recent care'}
          </h3>
          {cards
            .filter((card) => card.record?.note.trim())
            .map((card) => (
              <div key={card.key} className="care-handoff-note">
                <span>
                  {card.label} · {recorder(card.record?.created_by)}
                </span>
                <p>{card.record?.note}</p>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
