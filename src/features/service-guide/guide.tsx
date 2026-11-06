'use client';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  Baby,
  ChartNoAxesColumn,
  BookOpen,
  MessagesSquare,
  Bell,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { useRouter } from 'next/navigation';
import { FeedingPushSettings } from '@/features/notifications/feeding-push-settings';
import { completeServiceGuide } from './actions';
import styles from './guide.module.css';
const steps = [
  {
    icon: Baby,
    ko: '빠른 기록',
    en: 'Quick records',
    body: '하단의 기능을 눌러 수유·수면 등을 기록해요. 저장한 기록을 누르면 수정할 수 있어요.',
    english:
      'Tap a care icon below to record feeds, sleep and more. Tap a saved record to edit it.',
    target: 'today',
  },
  {
    icon: ChartNoAxesColumn,
    ko: '인사이트',
    en: 'Insights',
    body: '하루·주간 패턴과 성장 변화를 함께 살펴봐요.',
    english: 'Explore daily and weekly patterns, growth curves and milestones.',
    target: 'insights',
  },
  {
    icon: BookOpen,
    ko: '성장일기',
    en: 'Growth diary',
    body: '사진과 하루패턴·하루기록을 담아 추억을 남겨요. 원하는 일기는 공개하고 일기장 링크로 공유할 수 있어요.',
    english:
      'Keep memories with photos, daily patterns and records. Choose which entries to make public and share your diary by link.',
    target: 'community/diaries',
  },
  {
    icon: MessagesSquare,
    ko: '동네 소통',
    en: 'Neighborhood',
    body: '동네 놀이터에서 인사하고, 가까운 부모님들과 동네 이야기와 육아 고민을 나눠요.',
    english:
      'Say hello in the playground and share everyday parenting stories with other parents.',
    target: 'community',
  },
  {
    icon: Bell,
    ko: '필요한 알림만 골라요',
    en: 'Choose your notifications',
    body: '식사 알림은 기본 3시간 간격이에요. 동네 친구가 보내는 인사·하트·토닥토닥 알림도 따로 선택할 수 있어요.',
    english:
      'Feeding reminders default to three-hour intervals. You can also choose notifications for playground waves, hearts and comforting pats.',
    target: 'account',
  },
] as const;
type Preferences = Omit<
  ComponentProps<typeof FeedingPushSettings>,
  'locale' | 'compact' | 'onSaved' | 'onPendingChange'
>;
export function ServiceGuide({
  locale,
  preferences,
}: {
  locale: Locale;
  preferences: Preferences;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0),
    [closed, setClosed] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(false);
  const [spot, setSpot] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const ko = locale === 'ko',
    item = steps[step],
    Icon = item.icon;
  async function finish(saved = false) {
    if (busy || (saving && !saved)) return;
    setBusy(true);
    setError(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('guide');
    try {
      const result = await completeServiceGuide(locale);
      if (result.error) {
        setError(true);
        return;
      }
      dialog.current?.close();
      setClosed(true);
      router.replace(url.pathname + url.search, { scroll: false });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!closed && !dialog.current?.open) dialog.current?.showModal();
  }, [closed]);
  useEffect(() => {
    function locate() {
      const candidates =
        item.target === 'today'
          ? document.querySelectorAll('.mobile-function-rail')
          : document.querySelectorAll(`a[href^="/${locale}/${item.target}?"]`);
      const visible = Array.from(candidates).find((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight
        );
      });
      const r = visible?.getBoundingClientRect();
      setSpot(
        r
          ? {
              left: r.left - 4,
              top: r.top - 4,
              width: r.width + 8,
              height: r.height + 8,
            }
          : null,
      );
    }
    locate();
    window.addEventListener('resize', locate);
    return () => window.removeEventListener('resize', locate);
  }, [item, locale]);
  if (closed) return null;
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="service-guide-title"
      onCancel={(e) => {
        e.preventDefault();
        void finish();
      }}
    >
      {spot && (
        <div className={styles.spotlight} style={spot} aria-hidden="true" />
      )}
      <div className={styles.content}>
        <header>
          <span>
            {ko ? '포둥 처음 사용하기' : 'Getting started'} · {step + 1}/
            {steps.length}
          </span>
          <button
            type="button"
            disabled={busy || saving}
            onClick={() => void finish()}
            aria-label={ko ? '안내 건너뛰기' : 'Skip guide'}
          >
            <X size={19} />
          </button>
        </header>
        <div className={styles.icon}>
          <Icon size={30} />
        </div>
        <h2 id="service-guide-title">{ko ? item.ko : item.en}</h2>
        <p>{ko ? item.body : item.english}</p>
        <div
          className={styles.progress}
          aria-label={ko ? '안내 진행' : 'Guide progress'}
        >
          {steps.map((s, i) => (
            <span key={s.target} data-current={i === step} />
          ))}
        </div>
        {step === steps.length - 1 && (
          <FeedingPushSettings
            {...preferences}
            locale={locale}
            compact
            onPendingChange={setSaving}
            onSaved={() => void finish(true)}
          />
        )}
        {error && (
          <p role="alert">
            {ko
              ? '안내 완료를 저장하지 못했어요. 다시 눌러주세요.'
              : 'Could not save your progress. Please try again.'}
          </p>
        )}
        <footer>
          <button
            type="button"
            className="text-button"
            disabled={busy || saving}
            onClick={() => void finish()}
          >
            {step === steps.length - 1
              ? ko
                ? '나중에'
                : 'Later'
              : ko
                ? '건너뛰기'
                : 'Skip'}
          </button>
          <div>
            {step > 0 && (
              <button
                type="button"
                className="button secondary"
                disabled={busy || saving}
                onClick={() => setStep(step - 1)}
                aria-label={ko ? '이전 안내' : 'Previous tip'}
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {step < steps.length - 1 && (
              <button
                type="button"
                className="button"
                onClick={() => setStep(step + 1)}
              >
                {ko ? '다음' : 'Next'}
                <ChevronRight size={17} />
              </button>
            )}
          </div>
        </footer>
      </div>
    </dialog>
  );
}
