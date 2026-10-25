import type { Locale } from '@/lib/domain';
const ko = {
  title: '오늘의 질문',
  home: '오늘',
  empty: '등록된 질문이 없습니다. 운영자가 질문을 준비하면 표시됩니다.',
  vote: '선택 저장',
  selected: '내 선택',
  total: '전체 참여',
  votes: '표',
  closed: '투표 종료',
  opens: '시작',
  closes: '종료',
  basis:
    '질문은 한국 시간으로 매일 자정부터 다음 자정까지 열립니다. 마감 전 선택을 변경할 수 있습니다.',
  error: '저장하지 못했습니다. 마감 여부와 입력을 확인해주세요.',
  saved: '저장했습니다.',
  prev: '이전',
  next: '다음',
  create: '질문 만들기 · 예약',
  day: '한국 날짜',
  questionKo: '한국어 질문',
  questionEn: '영어 질문',
  optionKo: '한국어 선택지',
  optionEn: '영어 선택지',
  submit: '질문 저장',
  hide: '숨기기',
  unhide: '다시 표시',
  reason: '운영 사유',
  operations: '운영 작업',
  configuration:
    '한국어·영어 질문과 2~6개 선택지를 함께 입력하세요. 하루에 질문 하나이며, 시작 후에는 내용을 변경할 수 없습니다.',
  hidden: '숨김',
  edit: '예약 질문 수정',
  id: '질문 ID (새 질문은 비워두기)',
  results: '결과',
  privacy:
    '결과에는 총 참여 수와 선택지별 집계만 표시합니다. 다른 참여자의 계정 정보는 공개하지 않습니다.',
};
const en: typeof ko = {
  title: 'Daily question',
  home: 'Today',
  empty:
    'No questions have been published. A moderator can prepare the next question.',
  vote: 'Save selection',
  selected: 'Your selection',
  total: 'Total participants',
  votes: 'votes',
  closed: 'Voting closed',
  opens: 'Opens',
  closes: 'Closes',
  basis:
    'Each question opens at midnight in Korea and closes at the following midnight. You can change your selection before it closes.',
  error: 'Could not save. Check the closing time and your input.',
  saved: 'Saved.',
  prev: 'Previous',
  next: 'Next',
  create: 'Create or schedule a question',
  day: 'Korean date',
  questionKo: 'Korean question',
  questionEn: 'English question',
  optionKo: 'Korean option',
  optionEn: 'English option',
  submit: 'Save question',
  hide: 'Hide',
  unhide: 'Restore',
  reason: 'Moderation reason',
  operations: 'Operations',
  configuration:
    'Enter both languages and 2–6 bilingual options. One question per day; content cannot change after opening.',
  hidden: 'Hidden',
  edit: 'Edit scheduled question',
  id: 'Question ID (leave empty for new)',
  results: 'Results',
  privacy:
    'Results show only total participation and counts per option. Other voters’ account information is private.',
};
export function pollCopy(locale: Locale) {
  return locale === 'en' ? en : ko;
}
export function pollOptions(input: unknown): { ko: string; en: string }[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((value) =>
    value &&
    typeof value === 'object' &&
    'ko' in value &&
    'en' in value &&
    typeof value.ko === 'string' &&
    typeof value.en === 'string'
      ? [{ ko: value.ko, en: value.en }]
      : [],
  );
}
export function pollCounts(input: unknown): {
  total: number;
  counts: Record<string, number>;
} {
  if (
    !input ||
    typeof input !== 'object' ||
    !('total' in input) ||
    !('counts' in input)
  )
    return { total: 0, counts: {} };
  const counts: Record<string, number> = {};
  if (input.counts && typeof input.counts === 'object')
    for (const [key, value] of Object.entries(input.counts))
      if (typeof value === 'number') counts[key] = value;
  return { total: typeof input.total === 'number' ? input.total : 0, counts };
}
