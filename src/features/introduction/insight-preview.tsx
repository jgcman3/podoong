'use client';

import { useState } from 'react';
import {
  BookOpen,
  Check,
  Gift,
  Moon,
  Ruler,
  Scale,
  Utensils,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { DailyPattern } from '@/features/insights/daily-pattern';
import type { PatternCategory } from '@/features/insights/model';
import styles from './page.module.css';

const tabs = [
  ['daily', '하루패턴', 'Daily'],
  ['weekly', '주간패턴', 'Weekly'],
  ['stats', '통계', 'Stats'],
  ['growth', '성장곡선', 'Growth'],
  ['milestones', '마일스톤', 'Milestones'],
  ['guide', '가이드', 'Guide'],
  ['gifts', '선물·용돈', 'Gifts'],
] as const;

export function InsightPreview({
  locale,
  categories,
}: {
  locale: Locale;
  categories: PatternCategory[];
}) {
  const [selected, select] = useState<string>('daily');
  const ko = locale === 'ko';
  return (
    <div className={styles.insightDemo}>
      <div className={styles.demoHeading}>
        <span>{ko ? '포둥이의 인사이트' : 'Little Podoong’s insights'}</span>
        <small>{ko ? '예시 화면' : 'Example screen'}</small>
      </div>
      <div
        className={styles.demoTabs}
        role="group"
        aria-label={ko ? '인사이트 미리보기 선택' : 'Choose an insight preview'}
      >
        {tabs.map(([id, kr, en]) => (
          <button
            type="button"
            key={id}
            aria-pressed={id === selected}
            onClick={() => select(id)}
          >
            {ko ? kr : en}
          </button>
        ))}
      </div>
      <div className={styles.demoPanel} aria-live="polite">
        {selected === 'daily' && (
          <>
            <div className={styles.demoDate}>
              {ko ? '10월 29일' : 'Oct 29'} <span>D+120</span>
            </div>
            <DailyPattern
              categories={categories}
              locale={locale}
              day="2026-10-29"
              birthDate="2026-07-01"
            />
          </>
        )}
        {selected === 'weekly' && (
          <>
            <div className={styles.demoDate}>
              {ko ? '10월 23일 – 29일' : 'Oct 23 – 29'}
            </div>
            <svg
              viewBox="0 0 360 290"
              role="img"
              aria-label={
                ko
                  ? '일곱 날의 수유와 수면 패턴 예시'
                  : 'Example feeding and sleep patterns over seven days'
              }
            >
              {[0, 6, 12, 18, 24].map((hour, i) => (
                <g key={hour}>
                  <text x="0" y={24 + i * 58}>
                    {String(hour).padStart(2, '0')}
                  </text>
                  <line
                    x1="31"
                    x2="355"
                    y1={20 + i * 58}
                    y2={20 + i * 58}
                    stroke="currentColor"
                    opacity=".12"
                  />
                </g>
              ))}
              {Array.from({ length: 7 }, (_, i) => (
                <g key={i}>
                  <rect
                    x={36 + i * 46}
                    y="20"
                    width="35"
                    height="232"
                    rx="3"
                    fill="currentColor"
                    opacity=".025"
                  />
                  <rect
                    x={36 + i * 46}
                    y="20"
                    width="35"
                    height={47 + (i % 3) * 4}
                    fill="#a89acb"
                    opacity=".55"
                  />
                  <rect
                    x={36 + i * 46}
                    y={144 + (i % 3) * 7}
                    width="35"
                    height="15"
                    fill="#a89acb"
                    opacity=".55"
                  />
                  {[79, 116, 183, 218].map((y, j) => (
                    <rect
                      key={j}
                      x={36 + i * 46}
                      y={y + (i % 3) * 4}
                      width="35"
                      height="4"
                      fill={j === 1 ? '#33815b' : '#417bc0'}
                    />
                  ))}
                  <text x={54 + i * 46} y="277" textAnchor="middle">
                    {23 + i}
                  </text>
                </g>
              ))}
            </svg>
          </>
        )}
        {selected === 'stats' && (
          <>
            <div className={styles.demoDate}>
              {ko ? '먹은 양 · 최근 7일' : 'Feeding volume · 7 days'}
            </div>
            <div className={styles.demoMetric}>
              <strong>
                680 <small>ml</small>
              </strong>
              <span>{ko ? '하루 평균' : 'Daily average'}</span>
            </div>
            <svg
              viewBox="0 0 360 200"
              role="img"
              aria-label={
                ko
                  ? '분유와 이유식 먹은 양의 선그래프 예시'
                  : 'Example formula and solids volume chart'
              }
            >
              {[25, 80, 135].map((y) => (
                <line
                  key={y}
                  x1="15"
                  x2="345"
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  opacity=".1"
                />
              ))}
              <polyline
                points="15,65 70,90 125,55 180,70 235,40 290,56 345,30"
                fill="none"
                stroke="#417bc0"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <polyline
                points="15,140 70,132 125,138 180,118 235,125 290,110 345,105"
                fill="none"
                stroke="#33815b"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {[23, 24, 25, 26, 27, 28, 29].map((d, i) => (
                <text key={d} x={15 + i * 55} y="184" textAnchor="middle">
                  {d}
                </text>
              ))}
            </svg>
          </>
        )}
        {selected === 'growth' && (
          <>
            <div className={styles.demoDate}>
              {ko ? '몸무게 · 키 · 머리둘레' : 'Weight · Height · Head size'}
            </div>
            {[
              [Scale, '6.4 kg', '#c08778'],
              [Ruler, '62.5 cm', '#639b85'],
              [Ruler, '41.2 cm', '#8d83b8'],
            ].map(([Icon, value, color], i) => {
              const Graphic = Icon as typeof Scale;
              return (
                <div className={styles.growthSample} key={i}>
                  <Graphic
                    size={20}
                    style={{ color: color as string }}
                    aria-hidden="true"
                  />
                  <strong>{value as string}</strong>
                  <svg viewBox="0 0 170 54" aria-hidden="true">
                    <path
                      d={`M 5 ${44 - i * 3} Q 45 42 65 28 T 165 7`}
                      stroke={color as string}
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <circle cx="165" cy="7" r="3" fill={color as string} />
                  </svg>
                </div>
              );
            })}
            <span className={styles.demoHint}>
              {ko
                ? '성장 기록이 쌓이는 모습의 예시예요.'
                : 'An illustration of growth records over time.'}
            </span>
          </>
        )}
        {selected === 'milestones' && (
          <>
            <div className={styles.demoDate}>
              {ko ? '작은 변화도, 하나씩' : 'Little milestones, one by one'}
            </div>
            {(ko
              ? [
                  '움직임·신체발달',
                  '언어·의사소통',
                  '사회·정서',
                  '인지·문제해결',
                ]
              : [
                  'Movement & physical development',
                  'Language & communication',
                  'Social & emotional',
                  'Learning & problem-solving',
                ]
            ).map((label, i) => (
              <div key={label} className={styles.milestoneSample}>
                <span>{i < 2 ? <Check size={17} /> : null}</span>
                {label}
              </div>
            ))}
          </>
        )}
        {selected === 'guide' && (
          <>
            <div className={styles.demoDate}>
              {ko ? '월령에 맞춰 살펴보는 가이드' : 'Guidance for each stage'}
            </div>
            <div className={styles.guideSample}>
              {[
                [BookOpen, ko ? '신체 발달' : 'Development'],
                [Utensils, ko ? '먹이기' : 'Feeding'],
                [Moon, ko ? '수면 패턴' : 'Sleep'],
                [Ruler, ko ? '평균 체중·신장' : 'Growth reference'],
              ].map(([Icon, label]) => {
                const Graphic = Icon as typeof BookOpen;
                return (
                  <span key={label as string}>
                    <Graphic size={23} aria-hidden="true" />
                    {label as string}
                  </span>
                );
              })}
            </div>
          </>
        )}
        {selected === 'gifts' && (
          <>
            <div className={styles.demoDate}>
              {ko
                ? '사랑을 보내준 마음까지'
                : 'Remember the love behind each gift'}
            </div>
            <div className={styles.giftSample}>
              <Gift size={30} aria-hidden="true" />
              <strong>
                {ko ? '할머니가 준 첫 옷' : 'First outfit from Grandma'}
              </strong>
              <span>
                {ko
                  ? '선물은 사진과 함께, 준 사람별로'
                  : 'Gift photos, organized by giver'}
              </span>
            </div>
            <div className={styles.allowanceSample}>
              <span>{ko ? '받은 용돈' : 'Money received'}</span>
              <strong>₩ 100,000</strong>
            </div>
          </>
        )}
      </div>
      {['daily', 'weekly', 'stats'].includes(selected) && (
        <div className={styles.demoLegend}>
          {(
            [
              'formula',
              'solids',
              ...(selected === 'stats' ? [] : ['sleep']),
            ] as const
          ).map((kind, i) => (
            <span className={`quick-color-${kind}`} key={kind}>
              <i />
              {ko
                ? ['분유', '이유식', '수면'][i]
                : ['Formula', 'Solids', 'Sleep'][i]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
