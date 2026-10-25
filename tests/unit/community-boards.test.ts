import { describe, it, expect } from 'vitest';
import {
  makeBoards,
  boardCaption,
  chooseBoard,
} from '@/features/community/boards';
const locations = [
  {
    family_id: 'f',
    country_code: 'KR',
    country_name: '대한민국',
    scope: 'topic',
    region_code: null,
    region_name: null,
  },
  {
    family_id: 'f',
    country_code: 'KR',
    country_name: '대한민국',
    scope: 'district',
    region_code: 'district:11680',
    region_name: '서울특별시 강남구',
  },
  {
    family_id: 'f',
    country_code: 'KR',
    country_name: '대한민국',
    scope: 'locality',
    region_code: '1168010100',
    region_name: '서울특별시 강남구 역삼동',
  },
];
describe('community board choices', () => {
  it('shows short labels for home and national topic boards', () => {
    const boards = makeBoards(locations, 'ko');
    expect(boards).toHaveLength(7);
    expect(boards.find((b) => b.key === 'district')?.label).toBe(
      '강남구 게시판',
    );
    expect(boards.find((b) => b.key === 'locality')?.label).toBe(
      '역삼동 게시판',
    );
    expect(boards.find((b) => b.key === 'topic:feeding')?.label).toBe(
      '먹이기 게시판',
    );
    expect(boards.find((b) => b.key === 'topic:pregnancy')?.label).toBe(
      '임신 게시판',
    );
    expect(boards.find((b) => b.key === 'topic:daily')?.label).toBe(
      '일상 게시판',
    );
    expect(chooseBoard(boards, 'arbitrary-region')?.key).toBe('district');
  });
  it('does not invent home boards without a registered location', () => {
    expect(makeBoards([], 'ko')).toEqual([]);
    expect(chooseBoard([], 'district')).toBeUndefined();
  });
  it('uses short regional titles and meaningful topic labels in English', () => {
    expect(
      boardCaption(
        { scope: 'topic', region_label: '대한민국', topic: 'daily' },
        'en',
      ),
    ).toBe('Daily life board');
    expect(
      makeBoards(locations, 'en').find((b) => b.key === 'locality')?.label,
    ).toBe('역삼동 board');
  });
});
