'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, SlidersHorizontal } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { nextFeeding, nextMealTime, type MealPlan } from './meal-plan';

export function NextMeals({
  locale,
  childId,
  plan,
  available,
  timezone,
  latest,
  now,
}: {
  locale: Locale;
  childId: string;
  plan: MealPlan | null;
  available: boolean;
  timezone: string;
  latest: { ended_at: string | null } | null;
  now: string;
}) {
  const ko = locale === 'ko';
  const [clock, setClock] = useState(Date.parse(now));
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const timer = window.setInterval(tick, 30000);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, []);
  const items = [
    {
      key: 'feeding',
      title: ko ? '수유' : 'Milk feeding',
      at: nextFeeding(latest, plan?.feedingMinutes ?? null),
    },
    {
      key: 'solids',
      title: ko ? '이유식' : 'Solids',
      at: nextMealTime(plan?.solids ?? [], clock, timezone),
    },
  ];
  const scheduled = items
    .filter((item) => item.at !== null)
    .sort((a, b) => a.at! - b.at!);
  const format = new Intl.DateTimeFormat(ko ? 'ko-KR' : 'en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <section
      className="panel next-meals meal-notice"
      aria-labelledby="next-meals-title"
    >
      <span className="meal-notice-icon" aria-hidden="true">
        <Bell size={19} />
      </span>
      <div className="meal-notice-content">
        <div className="meal-notice-heading">
          <h2 id="next-meals-title">{ko ? '다음 먹이기' : 'Next feeding'}</h2>
          <Link
            href={`/${locale}/records?child=${childId}`}
            aria-label={ko ? '먹이기 기록·시간 설정' : 'Record & schedule'}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            {ko ? '시간 설정' : 'Settings'}
          </Link>
        </div>
        {scheduled.length ? (
          <div className="meal-timeline">
            {scheduled.map((item, index) => {
              const minutes = Math.ceil((item.at! - clock) / 60000);
              return (
                <article
                  key={item.key}
                  data-meal={item.key}
                  className={
                    index === 0 ? 'next-meal-primary' : 'next-meal-row'
                  }
                >
                  <strong>{item.title}</strong>
                  <time dateTime={new Date(item.at!).toISOString()}>
                    {format.format(item.at!)}
                  </time>
                  <span
                    className={`meal-countdown ${minutes <= 0 ? 'meal-due' : ''}`}
                  >
                    {minutes > 0
                      ? ko
                        ? `${minutes}분 남았어요`
                        : `In ${minutes} minutes`
                      : minutes === 0
                        ? ko
                          ? '설정한 시간이 되었어요'
                          : 'Your planned time is now'
                        : ko
                          ? `예상 시간에서 ${-minutes}분 지났어요`
                          : `${-minutes} minutes past your estimate`}
                  </span>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">
            {ko
              ? '돌봄 기록에서 다음 먹이기 시간을 설정해주세요.'
              : 'Set the next feeding from Care records.'}
          </p>
        )}
        {plan?.feedingMinutes && !latest?.ended_at && (
          <p className="small muted">
            {latest
              ? ko
                ? '진행 중인 수유가 끝나면 다음 수유 시간을 계산해요.'
                : 'The next milk feed is calculated when the current feed ends.'
              : ko
                ? '수유 기록을 남기면 다음 수유 시간을 계산해요.'
                : 'Add a milk feeding record to calculate the next feed.'}
          </p>
        )}
        {!available && (
          <p role="status">
            {ko
              ? '시간 설정 저장 기능을 준비 중입니다.'
              : 'Schedule storage is preparing.'}
          </p>
        )}
      </div>
    </section>
  );
}
