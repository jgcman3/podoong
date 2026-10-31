import { describe, it, expect } from 'vitest';
import { homeArea, parentingCategories } from '@/features/community/options';
import {
  supportRecord,
  collectSupport,
} from '../../supabase/functions/_shared/parenting-support.mjs';
const row = {
  서비스ID: 'fixture',
  서비스명: '아동 양육 지원',
  소관기관명: '서울특별시 강남구',
  소관기관유형: '시군구',
  상세조회URL: 'https://www.gov.kr/portal/service/serviceInfo/fixture',
};
const areas = ['서울특별시', '서울특별시 강남구', '서울특별시 강남구 역삼동'];
describe('parenting community', () => {
  it('keeps the requested category order', () =>
    expect(parentingCategories.map((v) => v[1])).toEqual([
      '전체',
      '어린이집',
      '놀이나들이',
      '육아용품',
      '발달훈육',
      '수유분유',
      '출산준비물',
      '산후조리',
      '건강증상',
      '유아식',
      '출산',
      '이유식',
    ]));
  it('handles municipality/district hierarchies and foreign same-name cities', () => {
    const kr = {
      residence_country_code: 'KR',
      residence_province: null,
      residence_city: '경기도 수원시 영통구',
      residence_locality: '매탄동',
    };
    expect(homeArea(kr)).toEqual({
      city: '경기도 수원시',
      district: '경기도 수원시 영통구',
      locality: '경기도 수원시 영통구 매탄동',
    });
    expect(homeArea({ ...kr, residence_city: '서울특별시 강남구' }).city).toBe(
      '서울특별시',
    );
    expect(
      homeArea({
        ...kr,
        residence_country_code: 'US',
        residence_province: 'California',
        residence_city: 'Springfield',
      }).city,
    ).toBe('California Springfield');
  });
  it('does not broaden district support or match another province’s same-named district', () => {
    expect(supportRecord(row, areas, 'run', 'now')?.region_terms).toEqual([
      '서울특별시 강남구',
    ]);
    expect(
      supportRecord(
        { ...row, 소관기관명: '부산광역시 중구' },
        ['서울특별시 중구'],
        'run',
        'now',
      ),
    ).toBeNull();
    expect(
      supportRecord(
        { ...row, 서비스명: '기업 시설 설비 지원' },
        areas,
        'run',
        'now',
      ),
    ).toBeNull();
    expect(
      supportRecord(
        { ...row, 소관기관유형: '중앙행정기관', 소관기관명: '보건복지부' },
        areas,
        'run',
        'now',
      )?.national,
    ).toBe(true);
  });
  it('rejects unsafe source URLs', () =>
    expect(() =>
      supportRecord(
        { ...row, 상세조회URL: 'https://evil.example/redirect' },
        areas,
        'run',
        'now',
      ),
    ).toThrow('invalid-source-url'));
  it('requires a complete snapshot before publishing', async () => {
    let page = 0;
    const fetcher = async () =>
      new Response(
        JSON.stringify(
          ++page === 1
            ? { totalCount: 2, data: [row] }
            : { totalCount: 2, data: [] },
        ),
      );
    await expect(
      collectSupport({ key: 'fixture', areas, runId: 'run', fetcher }),
    ).rejects.toThrow('incomplete-source');
  });
  it('rejects a changing source instead of silently losing records', async () => {
    let page = 0;
    await expect(
      collectSupport({
        key: 'fixture',
        areas,
        runId: 'run',
        fetcher: async () =>
          new Response(
            JSON.stringify({ totalCount: ++page === 1 ? 2 : 3, data: [row] }),
          ),
      }),
    ).rejects.toThrow('source-changed');
  });
  it('collects and deduplicates a complete snapshot', async () => {
    const records = await collectSupport({
      key: 'fixture',
      areas,
      runId: 'run',
      fetcher: async () =>
        new Response(JSON.stringify({ totalCount: 2, data: [row, row] })),
    });
    expect(records).toHaveLength(1);
    expect(records[0].run_id).toBe('run');
  });
});
