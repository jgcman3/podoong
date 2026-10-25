import type { Row } from '@/lib/db';
// Preview questions never enter the database or accept real votes.
export function examplePolls(today: string): Row<'daily_polls'>[] {
  const questions = [
    [
      '요즘 가장 도움이 되는 육아 지원은 무엇인가요?',
      'What support helps you most these days?',
      ['가족의 도움', '부모 모임', '혼자 쉬는 시간'],
      ['Family help', 'Parent groups', 'Time to rest'],
    ],
    [
      '가족과 함께 보내고 싶은 주말은?',
      'How would you like to spend a family weekend?',
      ['공원 산책', '집에서 쉬기', '가까운 나들이'],
      ['A park walk', 'Rest at home', 'A nearby outing'],
    ],
    [
      '가장 자주 기록하는 육아 일상은?',
      'What do you record most often?',
      ['수유', '수면', '성장'],
      ['Feeding', 'Sleep', 'Growth'],
    ],
    [
      '부모 커뮤니티에서 나누고 싶은 이야기는?',
      'What would you like to discuss with other parents?',
      ['우리 동네 정보', '육아 일상', '출산 준비'],
      ['Local information', 'Everyday parenting', 'Birth preparations'],
    ],
  ] as const;
  return questions.map(([ko, en, optionsKo, optionsEn], index) => {
    const day = new Date(Date.parse(`${today}T00:00:00Z`) - index * 86400000)
      .toISOString()
      .slice(0, 10);
    const opens = Date.parse(`${day}T00:00:00+09:00`);
    return {
      id: `example-${index}`,
      day,
      question_ko: ko,
      question_en: en,
      options: optionsKo.map((option, i) => ({ ko: option, en: optionsEn[i] })),
      hidden: false,
      opens_at: new Date(opens).toISOString(),
      closes_at: new Date(opens + 86400000).toISOString(),
      created_at: new Date(opens).toISOString(),
    };
  });
}
