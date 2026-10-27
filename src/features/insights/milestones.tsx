'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import {
  completedMonths,
  developmentStage,
  developmentStages,
} from './development-model';
import checklist from './reference/milestones.json';
import { setMilestone } from './milestone-actions';
import { useInsightsNavigation } from './navigation';
export function Milestones({
  child,
  birthDate,
  today,
  checked,
  writable,
  locale,
}: {
  child: string;
  birthDate: string | null;
  today: string;
  checked: string[];
  writable: boolean;
  locale: Locale;
}) {
  const ko = locale === 'ko',
    router = useRouter(),
    { navigate } = useInsightsNavigation();
  const [age, setAge] = useState(
    developmentStage(completedMonths(birthDate, today) ?? 0).month,
  );
  const [selected, setSelected] = useState(new Set(checked));
  const [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const stages = developmentStages.map((s) => s.month),
    index = stages.indexOf(age),
    stage = developmentStage(age);
  const items = checklist.filter((item) => item.month === age);
  async function toggle(key: string, achieved: boolean) {
    setPending(true);
    setError('');
    const before = new Set(selected);
    setSelected((previous) => {
      const next = new Set(previous);
      if (achieved) next.add(key);
      else next.delete(key);
      return next;
    });
    try {
      if (!(await setMilestone({ child, key, achieved, locale })))
        throw new Error('save');

      router.refresh();
    } catch {
      setSelected(before);
      setError(
        ko
          ? '저장하지 못했어요. 다시 시도해 주세요.'
          : 'Could not save. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="milestones-panel"
      aria-label={ko ? '마일스톤' : 'Milestones'}
    >
      <nav
        className="insight-day-nav development-age-nav"
        aria-label={ko ? '발달 월령 선택' : 'Milestone age'}
      >
        <button
          type="button"
          disabled={index === 0 || pending}
          aria-label={ko ? '이전 발달 월령' : 'Previous milestone age'}
          onClick={() => setAge(stages[index - 1])}
        >
          <ChevronLeft size={20} />
        </button>
        <strong aria-live="polite">
          {age}
          {ko ? '개월' : ' months'}
        </strong>
        <button
          type="button"
          disabled={index === stages.length - 1 || pending}
          aria-label={ko ? '다음 발달 월령' : 'Next milestone age'}
          onClick={() => setAge(stages[index + 1])}
        >
          <ChevronRight size={20} />
        </button>
      </nav>
      <div className="milestone-intro">
        <p>
          {ko
            ? `대부분의 아이가 ${age}개월까지 할 수 있는 주요 발달 항목이에요. 관찰한 행동을 체크해 주세요.`
            : `Selected skills most children can do by ${age} months. Check the behaviors you have observed.`}
        </p>
        <button
          type="button"
          onClick={() => navigate({ pattern: 'guide' }, true)}
        >
          {ko ? '성장 발달을 돕는 방법' : 'Ways to support development'}
        </button>
      </div>
      <p className="small muted" aria-live="polite">
        {items.filter((item) => selected.has(item.id)).length} / {items.length}{' '}
        {ko ? '항목 기록' : 'observations saved'}
      </p>
      {error && <p role="alert">{error}</p>}
      {(['motor', 'language', 'cognitive', 'social'] as const).map((group) => {
        const rows = items.filter((item) => item.group === group);
        if (!rows.length) return null;
        const labels = {
          motor: ko ? '움직임·신체 발달' : 'Movement',
          language: ko ? '언어·의사소통' : 'Language & communication',
          cognitive: ko ? '인지·학습' : 'Learning & thinking',
          social: ko ? '사회성·감정' : 'Social & emotional',
        };
        return (
          <section className="panel milestone-group" key={group}>
            <h2>{labels[group]}</h2>
            {rows.map((item) => (
              <label className="milestone-item" key={item.id}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  disabled={!writable || pending}
                  onChange={(e) => toggle(item.id, e.target.checked)}
                />
                <span>{item[ko ? 'ko' : 'en']}</span>
              </label>
            ))}
          </section>
        );
      })}
      <p className="development-note">
        {ko
          ? '체크하지 않은 항목이 발달 지연을 뜻하지는 않아요. 하던 행동을 잃거나 걱정되는 점이 있으면 소아청소년과에 상담해 주세요. 발달 선별검사를 대신하지 않아요.'
          : 'Unchecked items alone do not indicate a delay. Discuss lost skills or concerns with your clinician. This checklist is not a developmental screening test.'}
      </p>
      <a
        className="small"
        href={`https://www.cdc.gov/act-early/milestones/${stage.path}.html`}
        target="_blank"
        rel="noreferrer"
      >
        {ko ? 'CDC 전체 발달 항목' : 'Full CDC milestone checklist'} ↗
      </a>
    </section>
  );
}
