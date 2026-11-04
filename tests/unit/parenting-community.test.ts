import { describe, it, expect } from 'vitest';
import { postDetailSchema, postAuthor } from '@/features/community/post-model';
import {
  parentingCategories,
  parentingTags,
  neighborhoodTags,
} from '@/features/community/options';
describe('parenting community topics', () => {
  it('provides the requested topics with All separate from selectable post topics', () => {
    expect(parentingCategories.map((value) => value[1])).toEqual([
      '전체',
      '일상',
      '놀이',
      '발달',
      '훈육',
      '나들이',
      '이유식',
      '수유·분유',
      '육아용품',
      '건강·증상',
      '출산준비물',
      '산후조리',
      '출산',
      '기타',
    ]);
    expect(parentingTags.map((value) => value[0])).not.toContain('all');
  });
});

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
