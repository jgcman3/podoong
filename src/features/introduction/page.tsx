import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  Gift,
  Heart,
  Users,
  Bell,
  ChartNoAxesCombined,
  Sprout,
  Share2,
  Scale,
  Ruler,
  Baby,
  Utensils,
} from 'lucide-react';
import { BrandImage } from '@/components/brand-image';
import { InstallAppButton } from '@/components/install-app';
import { careIcons, careLabels } from '@/features/care/activity-config';
import { InsightPreview } from './insight-preview';
import type { PatternCategory } from '@/features/insights/model';
import { safeReturnPath, type Locale } from '@/lib/domain';
import styles from './page.module.css';
import exampleBoy from '../../../public/illustrations/diary-baby-boy.webp';
import exampleGirl from '../../../public/illustrations/diary-baby-girl.webp';

const copy = {
  ko: {
    name: '포둥',
    language: 'English',
    login: '로그인',
    start: '포둥 시작하기',
    eyebrow: '아이의 하루를, 가족과 함께',
    title: (
      <>
        함께 돌보는,
        <br />
        포근한 둥지
      </>
    ),
    description:
      '먹고, 자고, 자라는 순간을 간편하게 기록하고 가족과 함께 나눠요.',
    explore: '어떤 서비스인가요?',
    sample: '예시 화면',
    child: '포둥이',
    date: '10월 29일 (목)',
    total: '총 160 ml',
    quick: '누르는 순간, 기록의 시작',
    quickBody:
      '모유·분유·이유식부터 수면, 기저귀까지. 자주 쓰는 값과 시간 선택으로 짧고 간편하게 남겨요.',
    insightLead: '기록이 쌓이면, 우리 아이가 더 잘 보여요.',
    insightBody:
      '몇 시에 잘 자는지, 요즘 얼마나 먹는지. 기억에만 기대던 하루를 눈으로 확인해요.',
    insightItems: [
      [
        '하루·주간 패턴',
        '먹고 자는 시간을 겹쳐 보며 아이의 생활 리듬을 발견해요.',
      ],
      [
        '양·시간·횟수 통계',
        '먹은 양, 수면 시간, 기저귀 횟수의 변화를 그래프로 살펴봐요.',
      ],
      [
        '성장곡선·마일스톤·가이드',
        '몸무게·키·머리둘레와 월령별 발달, 육아 정보를 한곳에서 봐요.',
      ],
      [
        '선물·용돈 모아보기',
        '준 사람별 선물과 사진, 받은 용돈의 합계까지 정리해요.',
      ],
    ],
    tryPreview: '탭을 눌러 미리 살펴보세요.',
    communityLead: '같은 D+의 하루는, 어떤 모습일까요?',
    communityBody:
      '우리 아이의 추억을 남기는 곳에서, 비슷한 시기를 보내는 다른 가족의 이야기도 만나요.',
    diaryItems: [
      [
        '우리 아이 성장일기',
        '사진과 글, 하루 패턴·기록 이미지를 한 편의 일기에 담아요.',
      ],
      [
        '같은 D+ 아이들의 공개 일기',
        '같은 생후 일수의 일상과 몸무게·키·머리둘레 기록을 함께 살펴봐요.',
      ],
      [
        '전체 성장일기와 일기장 공유',
        '다양한 아이들의 공개 일기를 읽고, 우리 일기장은 링크로 전해요.',
      ],
    ],
    ownDiary: '우리 아이',
    cohortDiary: '출생일별',
    allDiary: '전체',
    diaryPeer: '봄이',
    diaryPeerNote: '뒤집기 성공! 매일 조금씩 새로운 얼굴을 보여줘요.',
    diaryPrivacy:
      '공개한 일기만 다른 사람에게 보여요. 비공개 일기는 가족과 간직해요.',
    notifyTitle: '다음 식사 시간도, 함께 챙겨요.',
    notifyBody:
      '마지막 식사 후 일정 간격, 또는 어제 먹었던 시각. 우리 가족에게 맞는 한 가지를 고르고, 필요 없을 땐 꺼두세요. 밤에는 알림을 쉬게 할 수도 있어요.',
    notifySample: '어제 이 시간에 분유 먹었어요',
    notifyMessage: '어제의 기록이에요. 오늘 아이의 식사 리듬을 살펴보세요.',
    notifyNote:
      '알림을 허용한 지원 기기에서 이용해요. 아이폰은 홈 화면에 추가한 뒤 알림을 켜주세요.',
    diaryNote: '처음으로 혼자 앉았어요.\n작은 순간인데, 오래 기억하고 싶어요.',
    diaryImage: '성장일기 예시 일러스트',
    family: '엄마도 아빠도, 같은 기록을 봐요',
    familyBody:
      '보호자를 초대해 함께 기록하고, 마지막 식사와 수면을 확인해요. “언제 먹었지?”를 다시 묻지 않아도 되도록.',
    closing: '오늘부터, 함께 돌봐요.',
    closingBody: '소셜 계정으로 시작하고 우리 아이의 첫 기록을 남겨보세요.',
    terms: '이용약관',
    privacy: '개인정보 처리방침',
    contact: '문의',
  },
  en: {
    name: 'podoong',
    language: '한국어',
    login: 'Log in',
    start: 'Start with podoong',
    eyebrow: 'A little life, cared for together',
    title: (
      <>
        Care together.
        <br />
        Grow closer.
      </>
    ),
    description:
      'Keep feeding, sleep and growing moments in one cozy place, together with your family.',
    explore: 'Take a look inside',
    sample: 'Example screen',
    child: 'Little Podoong',
    date: 'Oct 29 (Thu)',
    total: '160 ml total',
    quick: 'A little tap. A little care.',
    quickBody:
      'From breastfeeds, bottles and solids to sleep and diapers. Save a record with familiar amounts and simple time choices.',
    insightLead: 'Their little rhythms, coming into view.',
    insightBody:
      'When do they sleep best? How much have they been eating? See the everyday details you used to hold in your head.',
    insightItems: [
      [
        'Daily & weekly patterns',
        'Layer feeding and sleep records to get to know their rhythm.',
      ],
      [
        'Volume, time & count',
        'Follow feeding amounts, sleep duration and diaper counts in charts.',
      ],
      [
        'Growth, milestones & guidance',
        'Keep weight, height, head size and age-based development together.',
      ],
      [
        'Gifts & money received',
        'Keep gift photos and totals organized by the people who gave them.',
      ],
    ],
    tryPreview: 'Tap a tab to take a look.',
    communityLead: 'What does the same D+ look like for others?',
    communityBody:
      'Keep your own memories, and meet families going through a similar stage.',
    diaryItems: [
      [
        'Your child’s diary',
        'Save photos, words and images of daily patterns and records.',
      ],
      [
        'Public diaries at the same D+',
        'Explore everyday stories, weight, height and head-size records at the same age in days.',
      ],
      [
        'More stories, and a link to yours',
        'Browse public diaries and share your child’s diary with a link.',
      ],
    ],
    ownDiary: 'My child',
    cohortDiary: 'Same D+',
    allDiary: 'All',
    diaryPeer: 'Sunny',
    diaryPeerNote:
      'Rolled over today! Every day brings a little something new.',
    diaryPrivacy:
      'Only public entries appear to others. Keep private entries within your family.',
    notifyTitle: 'A little help with the next feed.',
    notifyBody:
      'Choose an interval after the last feed, or a reference to yesterday’s feeding time. Pick one, turn reminders off anytime, and keep nights quiet.',
    notifySample: 'Yesterday at this time: formula',
    notifyMessage:
      'A reference to yesterday’s record. Check your child’s rhythm today.',
    notifyNote:
      'Available on supported devices with notification permission. On iPhone, add podoong to the Home Screen first.',
    diaryNote:
      'Sat up all by yourself today.\nA little moment I want to remember.',
    diaryImage: 'Illustration for the example diary',
    family: 'Different caregivers. The same page.',
    familyBody:
      'Invite caregivers to record together and see the latest feed or sleep. Less asking, “When was the last bottle?”',
    closing: 'A cozy start, together.',
    closingBody:
      'Sign in with a social account and save your child’s first moment.',
    terms: 'Terms',
    privacy: 'Privacy Policy',
    contact: 'Contact',
  },
};

// Fixed, synthetic records only. This public page never loads family or diary data.
const day = '2026-10-29';
const categories: PatternCategory[] = [
  {
    kind: 'sleep',
    days: [
      {
        date: day,
        untimed: 0,
        segments: [
          { start: 0, end: 360 },
          { start: 740, end: 810 },
          { start: 1200, end: 1440 },
        ],
      },
    ],
  },
  {
    kind: 'formula',
    days: [
      {
        date: day,
        untimed: 0,
        segments: [400, 660, 840, 1100].map((start) => ({
          start,
          end: start + 20,
        })),
      },
    ],
  },
  {
    kind: 'solids',
    days: [{ date: day, untimed: 0, segments: [{ start: 570, end: 590 }] }],
  },
];

export function Introduction({
  locale,
  next: requestedNext,
}: {
  locale: Locale;
  next?: string;
}) {
  const t = copy[locale],
    other = locale === 'ko' ? 'en' : 'ko';
  const next = safeReturnPath(requestedNext, locale);
  const login = `/${locale}/login?next=${encodeURIComponent(next)}`;
  const otherNext = `/${other}${next.slice(3)}`;
  const labels = careLabels(locale);
  const records = [
    { time: '14:20', kind: 'diaper', detail: locale === 'ko' ? '소변' : 'Wet' },
    { time: '13:50', kind: 'formula', detail: '160 ml' },
    {
      time: '12:10',
      kind: 'sleep',
      detail: locale === 'ko' ? '1시간 10분' : '1 hr 10 min',
    },
  ] as const;
  const start = (className = styles.primary) => (
    <Link className={className} href={login}>
      {t.start}
      <ArrowRight size={18} aria-hidden="true" />
    </Link>
  );
  return (
    <main className={styles.scene}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link
            href={`/${locale}/intro`}
            className={styles.brand}
            aria-label={t.name}
          >
            <BrandImage />
            <span>{t.name}</span>
          </Link>
          <nav
            aria-label={
              locale === 'ko' ? '소개 페이지 메뉴' : 'Introduction navigation'
            }
          >
            <Link
              href={`/${other}/intro?next=${encodeURIComponent(otherNext)}`}
              lang={other}
              hrefLang={other}
            >
              {t.language}
            </Link>
            <Link href={login} className={styles.login}>
              {t.login}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </nav>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p>{t.description}</p>
            {start()}
            <a href="#features" className={styles.explore}>
              {t.explore}
              <ArrowDown size={16} aria-hidden="true" />
            </a>
          </div>
          <figure className={styles.preview} aria-label={t.sample}>
            <div className={styles.previewHead}>
              <span>
                <Heart size={17} aria-hidden="true" />
                {t.child} <small>D+120</small>
              </span>
              <span className={styles.sample}>{t.sample}</span>
            </div>
            <div className={styles.previewDate}>
              <strong>{t.date}</strong>
              <span>{t.total}</span>
            </div>
            <div className={styles.timeline}>
              {records.map(({ time, kind, detail }) => {
                const Icon = careIcons[kind];
                return (
                  <div className={styles.record} key={kind}>
                    <time>{time}</time>
                    <span className={styles.dot} />
                    <div className={`${styles.recordCard} quick-color-${kind}`}>
                      <Icon size={24} aria-hidden="true" />
                      <strong>{labels[kind]}</strong>
                      <span>{detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.previewRail}>
              {(
                ['breast', 'formula', 'solids', 'diaper', 'sleep'] as const
              ).map((kind) => {
                const Icon = careIcons[kind];
                return (
                  <span key={kind} className={`quick-color-${kind}`}>
                    <i>
                      <Icon size={23} aria-hidden="true" />
                    </i>
                    {labels[kind]}
                  </span>
                );
              })}
            </div>
            <figcaption>{t.quick}</figcaption>
          </figure>
        </section>

        <section id="features" className={styles.recordIntro}>
          <div>
            <span className={styles.number}>01 / EVERYDAY CARE</span>
            <h2>{t.quick}</h2>
            <p>{t.quickBody}</p>
          </div>
          <div className={styles.chips}>
            {(['formula', 'sleep', 'diaper'] as const).map((kind) => {
              const Icon = careIcons[kind];
              return (
                <span key={kind} className={`quick-color-${kind}`}>
                  <Icon size={22} aria-hidden="true" />
                  {labels[kind]}
                  <Check size={15} aria-hidden="true" />
                </span>
              );
            })}
          </div>
        </section>

        <section className={styles.spotlight}>
          <div className={styles.spotlightCopy}>
            <span className={styles.number}>02 / INSIGHTS</span>
            <h2>{t.insightLead}</h2>
            <p>{t.insightBody}</p>
            <ul className={styles.benefits}>
              {t.insightItems.map(([title, body], index) => {
                const Icon = [ChartNoAxesCombined, Utensils, Sprout, Gift][
                  index
                ];
                return (
                  <li key={title}>
                    <Icon size={21} aria-hidden="true" />
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <span className={styles.tryPreview}>
              {t.tryPreview}
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </div>
          <InsightPreview locale={locale} categories={categories} />
        </section>

        <section className={`${styles.spotlight} ${styles.diarySpotlight}`}>
          <div className={styles.spotlightCopy}>
            <span className={styles.number}>03 / GROW TOGETHER</span>
            <h2>{t.communityLead}</h2>
            <p>{t.communityBody}</p>
            <ul className={styles.benefits}>
              {t.diaryItems.map(([title, body], index) => {
                const Icon = [BookOpen, Baby, Share2][index];
                return (
                  <li key={title}>
                    <Icon size={21} aria-hidden="true" />
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className={styles.privacyNote}>{t.diaryPrivacy}</p>
          </div>
          <figure className={styles.communityDemo}>
            <div className={styles.diaryTabs}>
              <span>{t.ownDiary}</span>
              <strong>{t.cohortDiary}</strong>
              <span>{t.allDiary}</span>
            </div>
            <div className={styles.cohortAge}>
              <span>‹</span>
              <strong>D+120</strong>
              <span>›</span>
            </div>
            {[
              {
                name: t.child,
                weight: '6.4',
                height: '62.5',
                head: '41.2',
                note: t.diaryNote,
              },
              {
                name: t.diaryPeer,
                weight: '6.2',
                height: '61.8',
                head: '40.8',
                note: t.diaryPeerNote,
              },
            ].map((entry, i) => (
              <div className={styles.publicDiary} key={entry.name}>
                <header>
                  <strong>
                    <Baby size={17} aria-hidden="true" />
                    {entry.name}
                  </strong>
                  <div>
                    <span>
                      <Scale
                        size={13}
                        aria-label={locale === 'ko' ? '몸무게' : 'Weight'}
                      />
                      {entry.weight}
                      <small>kg</small>
                    </span>
                    <span>
                      <Ruler
                        size={13}
                        aria-label={locale === 'ko' ? '키' : 'Height'}
                      />
                      {entry.height}
                      <small>cm</small>
                    </span>
                    <span>
                      <Baby
                        size={13}
                        aria-label={locale === 'ko' ? '머리둘레' : 'Head size'}
                      />
                      {entry.head}
                      <small>cm</small>
                    </span>
                  </div>
                </header>
                <div className={styles.publicDiaryBody}>
                  <p>{entry.note}</p>
                  <div className={styles.diaryPicture}>
                    <Image
                      src={i ? exampleGirl : exampleBoy}
                      alt={
                        locale === 'ko'
                          ? `${entry.name} 예시 아이 일러스트`
                          : `Fictional baby illustration for ${entry.name}`
                      }
                      width={220}
                      height={220}
                      sizes="(max-width: 900px) 105px, 110px"
                    />
                  </div>
                </div>
              </div>
            ))}
            <figcaption>
              {t.sample} · {t.diaryImage}
            </figcaption>
          </figure>
        </section>

        <section className={styles.notificationSection}>
          <div>
            <span className={styles.number}>04 / A GENTLE REMINDER</span>
            <h2>{t.notifyTitle}</h2>
            <p>{t.notifyBody}</p>
            <small>{t.notifyNote}</small>
          </div>
          <figure className={styles.notificationDemo}>
            <div>
              <span className={styles.bellIcon}>
                <Bell size={21} aria-hidden="true" />
              </span>
              <strong>podoong</strong>
              <small>{locale === 'ko' ? '지금' : 'now'}</small>
            </div>
            <h3>{t.notifySample}</h3>
            <p>{t.notifyMessage}</p>
            <figcaption>{t.sample}</figcaption>
          </figure>
        </section>

        <section className={styles.family}>
          <span className={styles.familyIcon}>
            <Users size={27} aria-hidden="true" />
          </span>
          <div>
            <h2>{t.family}</h2>
            <p>{t.familyBody}</p>
          </div>
        </section>
        <section className={styles.closing}>
          <BrandImage large />
          <h2>{t.closing}</h2>
          <p>{t.closingBody}</p>
          <div className={styles.closingActions}>
            {start()}
            <InstallAppButton locale={locale} variant="intro" />
          </div>
        </section>
        <footer className={styles.footer}>
          <span>podoong</span>
          <nav
            aria-label={locale === 'ko' ? '서비스 정보' : 'Service information'}
          >
            <Link
              href={`/${locale}/legal/terms?source=login&next=${encodeURIComponent(next)}`}
            >
              {t.terms}
            </Link>
            <Link
              href={`/${locale}/legal/privacy?source=login&next=${encodeURIComponent(next)}`}
            >
              {t.privacy}
            </Link>
            <a href="mailto:jgcman3@gmail.com">{t.contact}</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
