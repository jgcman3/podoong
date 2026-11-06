import { it, expect } from 'vitest';
import { postDetailSchema, postAuthor } from '@/features/community/post-model';
import { neighborhoodTags } from '@/features/community/options';

it('renders an unassigned caregiver relationship without breaking the feed', () => {
  const author = postDetailSchema.shape.author.parse({
    family: '포둥네',
    child: '봄이',
    relationship: null,
    initial: '정',
  });
  expect(postAuthor(author, 'ko')).toBe('포둥네 보호자');
});

it('keeps neighborhood categories in their own fixed order', () => {
  expect(neighborhoodTags.map(([, label]) => label)).toEqual([
    '동네일상',
    '동네나들이',
    '생활정보',
    '질문·도움',
    '어린이집·유치원',
    '중고나눔·거래',
    '기타',
  ]);
});
