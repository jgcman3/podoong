import { describe, it, expect } from 'vitest';
import { postDetailSchema, postAuthor } from '@/features/community/post-model';
import {
  parentingCategories,
  parentingTags,
} from '@/features/community/options';
describe('parenting community topics', () => {
  it('provides the requested topics with All separate from selectable post topics', () => {
    expect(parentingCategories.map((value) => value[1])).toEqual([
      '전체',
      '놀이',
      '육아용품',
      '발달',
      '훈육',
      '수유·분유',
      '이유식',
      '출산준비물',
      '산후조리',
      '건강·증상',
      '출산',
      '여행',
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
