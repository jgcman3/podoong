'use client';
import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Baby,
  Moon,
  Utensils,
  Ruler,
  ShieldCheck,
  Heart,
} from 'lucide-react';
import Link from 'next/link';
import type { Locale } from '@/lib/domain';
import {
  completedMonths,
  developmentStage,
  sleepHours,
} from './development-model';

export function DevelopmentGuide({
  birthDate,
  today,
  child,
  locale,
}: {
  birthDate: string | null;
  today: string;
  child: string;
  locale: Locale;
}) {
  const ko = locale === 'ko',
    current = completedMonths(birthDate, today);
  const [month, setMonth] = useState(Math.min(60, current ?? 0));
  const stage = developmentStage(month);
  const source = `https://www.cdc.gov/act-early/milestones/${stage.path}.html`;
  const feeding =
    month < 6
      ? ko
        ? '모유 또는 영아용 분유가 주된 영양 공급원이에요. 이유식은 일반적으로 생후 약 6개월부터 시작해요.'
        : 'Breast milk or infant formula is the main source of nutrition. Complementary foods generally begin at about 6 months.'
      : month < 9
        ? ko
          ? '모유·분유를 이어가며 이유식을 조금씩 늘려요. WHO는 모유 수유 중인 6–8개월 아기의 보충식으로 하루 2–3회를 안내해요.'
          : 'Continue milk feeds as complementary foods gradually increase. WHO advises 2–3 complementary meals daily for breastfed babies aged 6–8 months.'
        : month < 24
          ? ko
            ? '다양한 맛과 질감을 경험하게 해주세요. WHO는 모유 수유 중인 9–23개월 아이의 보충식으로 하루 3–4회, 필요에 따라 간식 1–2회를 안내해요.'
            : 'Offer varied tastes and textures. WHO advises 3–4 complementary meals daily for breastfed children aged 9–23 months, with 1–2 snacks as needed.'
          : ko
            ? '가족과 함께 다양한 음식을 경험하고, 스스로 먹는 시간을 주세요. 식사량은 아이의 배고픔과 포만감 신호에 맞춰요.'
            : 'Share varied family foods and allow time for self-feeding. Follow your child’s hunger and fullness cues.';
  return (
    <section
      className="development-guide"
      aria-label={ko ? '육아 및 발달 정보' : 'Care and development information'}
    >
      <nav
        className="insight-day-nav development-age-nav"
        aria-label={ko ? '월령 선택' : 'Select age'}
      >
        <button
          type="button"
          aria-label={ko ? '이전 월령' : 'Previous month'}
          disabled={month === 0}
          onClick={() => setMonth(month - 1)}
        >
          <ChevronLeft size={20} />
        </button>
        <strong aria-live="polite">
          {month}
          {ko ? '개월' : ' months'}
        </strong>
        <button
          type="button"
          aria-label={ko ? '다음 월령' : 'Next month'}
          disabled={month === 60}
          onClick={() => setMonth(month + 1)}
        >
          <ChevronRight size={20} />
        </button>
      </nav>
      {current === null && (
        <p className="muted small">
          {ko
            ? '출생일을 등록하면 아이의 월령부터 보여드려요.'
            : 'Add a birth date to start at your child’s age.'}
        </p>
      )}
      {current !== null && current > 60 && (
        <p className="muted small">
          {ko
            ? '현재 안내는 생후 0–60개월을 대상으로 해요.'
            : 'This guide covers ages 0–60 months.'}
        </p>
      )}
      <div className="development-cards">
        <article className="panel">
          <h2>
            <Baby />
            {ko ? '발달 살펴보기' : 'Development'}
          </h2>
          <span className="development-age-label">
            {ko
              ? `${stage.month}개월 무렵의 발달 이정표`
              : `Milestones by ${stage.month} months`}
          </span>
          <ul>
            {stage[ko ? 'ko' : 'en'].map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <a href={source} target="_blank" rel="noreferrer">
            {ko ? 'CDC 발달 기준' : 'CDC milestones'} ↗
          </a>
        </article>
        <article className="panel">
          <h2>
            <Heart />
            {ko ? '함께 해보세요' : 'Try together'}
          </h2>
          <p>{stage.tip[ko ? 0 : 1]}</p>
          <a href={source} target="_blank" rel="noreferrer">
            {ko ? 'CDC 놀이·육아 팁' : 'CDC parenting tips'} ↗
          </a>
        </article>
        <article className="panel">
          <h2>
            <Utensils />
            {ko ? '먹이기' : 'Feeding'}
          </h2>
          <p>{feeding}</p>
          <a
            href={
              month >= 6 && month < 24
                ? 'https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding'
                : 'https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/index.html'
            }
            target="_blank"
            rel="noreferrer"
          >
            {ko ? '먹이기 참고 자료' : 'Feeding reference'} ↗
          </a>
        </article>
        <article className="panel">
          <h2>
            <Moon />
            {ko ? '수면' : 'Sleep'}
          </h2>
          <p className="development-sleep">
            {sleepHours(month)}
            <small>{ko ? '시간 / 하루' : 'hours / day'}</small>
          </p>
          <p>
            {ko
              ? '낮잠을 포함한 권장 총 수면 시간이에요. 아이마다 수면 리듬은 달라요.'
              : 'Recommended total sleep, including naps. Individual sleep rhythms vary.'}
          </p>
          <a
            href="https://www.cdc.gov/sleep/about/"
            target="_blank"
            rel="noreferrer"
          >
            {ko ? 'CDC 수면 권장 범위' : 'CDC sleep recommendations'} ↗
          </a>
        </article>
        <article className="panel">
          <h2>
            <Ruler />
            {ko ? '키·몸무게 살펴보기' : 'Height & weight'}
          </h2>
          <p>
            {ko
              ? '성별과 월령에 따른 성장 곡선에서 변화 추이를 살펴보세요. 한 번의 수치만으로 성장을 판단하지 않아요.'
              : 'Follow changes over time using age- and sex-specific growth charts, rather than a single measurement.'}
          </p>
          <a
            href="https://www.who.int/toolkits/child-growth-standards"
            target="_blank"
            rel="noreferrer"
          >
            {ko ? 'WHO 성장 기준' : 'WHO growth standards'} ↗
          </a>
        </article>
        <article className="panel">
          <h2>
            <ShieldCheck />
            {ko ? '예방접종' : 'Vaccinations'}
          </h2>
          <p>
            {ko
              ? '접종 시기는 이전 접종 내역과 백신 종류에 따라 달라져요. 아이의 기록과 국가 접종 안내를 함께 확인해 주세요.'
              : 'Timing depends on previous doses and vaccine type. Check your child’s records alongside national guidance.'}
          </p>
          <div className="development-links">
            <Link href={`/${locale}/vaccinations?child=${child}`}>
              {ko ? '아이 접종 기록' : 'Child’s vaccination records'}
            </Link>
            <a
              href="https://nip.kdca.go.kr/irhp/index.jsp"
              target="_blank"
              rel="noreferrer"
            >
              {ko ? '질병관리청 접종 안내' : 'KDCA vaccination guidance'} ↗
            </a>
          </div>
        </article>
      </div>
      <p className="development-note">
        {ko
          ? '발달 속도에는 개인차가 있어요. 하던 행동을 하지 못하거나 발달이 걱정되면 소아청소년과에 상담해 주세요. 이 정보는 진단이나 개별 처방을 대신하지 않아요.'
          : 'Development varies. Talk with your child’s clinician about lost skills or concerns. This guide does not replace individual medical advice.'}
      </p>
      <p className="small muted">
        {ko ? '자료 확인' : 'Sources reviewed'} · 2026-10-27
      </p>
    </section>
  );
}
