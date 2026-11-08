import Link from 'next/link';
import { BookOpen, PenLine } from 'lucide-react';
import { ChildIcon } from '@/components/child-icon';
import type { CareContext } from '@/lib/data';
import type { Locale } from '@/lib/domain';
import { DiaryComposer } from './composer';

export function DiaryEmptyState({
  context,
  locale,
  scope,
  age,
  page,
  href,
}: {
  context: Pick<CareContext, 'child' | 'writable' | 'privacy'>;
  locale: Locale;
  scope: 'mine' | 'birth' | 'all';
  age: number;
  page: number;
  href: (scope: string) => string;
}) {
  const ko = locale === 'ko';
  const { child, writable, privacy } = context;
  const missingBirth = scope === 'birth' && !child.birth_date;
  const firstEntry = scope === 'mine' && page === 0 && writable;
  let [title, body] = ko
    ? [
        '첫 공개 이야기를 기다리고 있어요',
        '나누고 싶은 하루가 모이는 곳이에요. 먼저 우리 아이 일기장에 추억을 남겨보세요.',
      ]
    : [
        'Waiting for the first shared stories',
        'A place for days families choose to share. Begin with a memory in your own child’s diary.',
      ];
  if (page > 0) {
    [title, body] = ko
      ? [
          '이 페이지에는 일기가 없어요',
          '최근 일기로 돌아가 다른 이야기를 살펴보세요.',
        ]
      : [
          'No entries on this page',
          'Return to the latest entries to explore more stories.',
        ];
  } else if (missingBirth) {
    [title, body] = ko
      ? [
          '아이의 출생일을 알려주세요',
          '출생일을 등록하면 같은 시기의 아이들 이야기를 살펴볼 수 있어요.',
        ]
      : [
          'Add your child’s birth date',
          'A birth date helps you find stories from the same stage.',
        ];
  } else if (firstEntry) {
    [title, body] = ko
      ? [
          `${child.name}의 첫 이야기를 남겨보세요`,
          '사진 한 장이나 짧은 한마디면 충분해요.',
        ]
      : [
          `Start ${child.name}’s story`,
          'A photo or a few words is enough to begin.',
        ];
  } else if (scope === 'mine') {
    [title, body] = ko
      ? [
          `${child.name}의 이야기를 기다리고 있어요`,
          '가족이 일기를 남기면 이곳에서 함께 볼 수 있어요.',
        ]
      : [
          `Waiting for ${child.name}’s stories`,
          'When your family adds a diary, you can enjoy it together here.',
        ];
  } else if (scope === 'birth') {
    [title, body] = ko
      ? [
          `D+${age}의 이야기를 기다리고 있어요`,
          '아직 이 시기에 공개된 일기가 없어요. 우리 아이의 하루부터 남겨볼까요?',
        ]
      : [
          `Waiting for stories from D+${age}`,
          'No public entries at this stage yet. Start with your own child’s day.',
        ];
  }
  return (
    <section className="panel diary-empty diary-welcome">
      <span className="diary-empty-mark">
        {scope === 'mine' ? (
          <ChildIcon sex={child.sex} size={32} />
        ) : (
          <BookOpen size={30} aria-hidden="true" />
        )}
      </span>
      <h2>{title}</h2>
      <p>{body}</p>
      {firstEntry && (
        <>
          <ul className="diary-empty-prompts">
            {(ko
              ? ['기억하고 싶은 표정', '처음 해본 일', '함께 보낸 시간']
              : ['A face to remember', 'A little first', 'Time together']
            ).map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
          <DiaryComposer
            child={child.id}
            locale={locale}
            privacy={privacy}
            firstEntry
            triggerClassName="button primary diary-first-write"
            triggerLabel={ko ? '첫 일기 남기기' : 'Write the first entry'}
            trigger={
              <>
                <PenLine size={17} aria-hidden="true" />
                <span>{ko ? '첫 일기 남기기' : 'Write the first entry'}</span>
              </>
            }
          />
        </>
      )}
      <div className="diary-empty-actions">
        {page > 0 ? (
          <Link className="text-link" href={href(scope)}>
            {ko ? '최근 일기로 돌아가기' : 'Back to latest entries'}
          </Link>
        ) : missingBirth ? (
          <Link
            className="text-link"
            href={`/${locale}/account?child=${child.id}&panel=child`}
          >
            {ko ? '출생일 등록' : 'Add birth date'}
          </Link>
        ) : (
          scope !== 'mine' && (
            <>
              {scope === 'birth' && (
                <Link className="text-link" href={href('all')}>
                  {ko ? '전체 공개 일기 보기' : 'Explore public diaries'}
                </Link>
              )}
              <Link className="text-link" href={href('mine')}>
                {ko ? '우리 아이 일기장으로' : 'Go to our child’s diary'}
              </Link>
            </>
          )
        )}
      </div>
    </section>
  );
}
