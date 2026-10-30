import { describe, expect, it } from 'vitest';
import {
  diaryRecordRows,
  recordImagePages,
} from '@/features/growth-community/record-image-model';
import type { QuickEntry } from '@/features/care/quick-model';
const entry = (more: Partial<QuickEntry> = {}): QuickEntry => ({
  id: 'record',
  source: 'feeding',
  service: 'feeding',
  kind: 'formula',
  startedAt: '2026-10-29T01:20:00Z',
  endedAt: null,
  version: 1,
  amount: 120,
  unit: 'ml',
  title: '',
  running: false,
  ...more,
});
const now = Date.parse('2026-10-29T12:00:00Z');
describe('diary daily-record images', () => {
  it('exports local clock, recorded amount and optional duration in the selected language', () => {
    const feed = entry({ endedAt: '2026-10-29T01:35:00Z' });
    expect(
      diaryRecordRows(
        [feed],
        '2026-10-29',
        '2026-10-29',
        'Asia/Seoul',
        'ko',
        now,
      ),
    ).toEqual([
      {
        time: '10:20',
        label: '분유',
        detail: '120 ml · 15분',
        color: 'formula',
      },
    ]);
    expect(
      diaryRecordRows(
        [entry()],
        '2026-10-29',
        '2026-10-29',
        'Asia/Seoul',
        'en',
        now,
      )[0],
    ).toEqual({
      time: '10:20',
      label: 'Formula',
      detail: '120 ml',
      color: 'formula',
    });
  });
  it('does not attach unrelated days, future or unfinished historical records', () => {
    const records = [
      entry(),
      entry({ id: 'future', startedAt: '2026-10-29T14:00:00Z' }),
      entry({ id: 'yesterday', startedAt: '2026-10-28T01:00:00Z' }),
      entry({
        id: 'running',
        kind: 'breast',
        running: true,
        startedAt: '2026-10-28T02:00:00Z',
      }),
    ];
    expect(
      diaryRecordRows(
        records,
        '2026-10-29',
        '2026-10-29',
        'Asia/Seoul',
        'ko',
        now,
      ).map((row) => row.label),
    ).toEqual(['분유', '모유']);
    expect(
      diaryRecordRows(
        records,
        '2026-10-28',
        '2026-10-29',
        'Asia/Seoul',
        'ko',
        now,
      ),
    ).toHaveLength(1);
  });
  it('does not duplicate bowel records as diapers or export private diary prose', () => {
    const rows = diaryRecordRows(
      [
        entry({
          source: 'child',
          service: 'diaper',
          kind: 'dirty',
          amount: null,
          unit: null,
        }),
        entry({
          source: 'child',
          service: 'diaper',
          kind: 'diaper_dirty',
          amount: null,
          unit: null,
        }),
        entry({
          source: 'child',
          service: 'growth',
          kind: 'observation',
          title: 'PRIVATE_TITLE',
          amount: null,
          childRecord: {
            note: 'PRIVATE_NOTE',
            weight_kg: 8.1,
            height_cm: 70,
            head_cm: 43,
          } as QuickEntry['childRecord'],
        }),
      ],
      '2026-10-29',
      '2026-10-29',
      'Asia/Seoul',
      'ko',
      now,
    );
    expect(rows[0]).toMatchObject({ label: '대변', color: 'stool' });
    expect(rows[1]).toMatchObject({ label: '대변', color: 'diaper' });
    expect(rows[2]).toMatchObject({
      label: '성장 기록',
      detail: '8.1 kg · 70 cm · 43 cm',
    });
    expect(JSON.stringify(rows)).not.toContain('PRIVATE');
  });
  it('splits long days across portrait images without losing or repeating records', () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      time: String(index),
      label: 'Formula',
      detail: '120 ml',
      color: 'formula',
    }));
    const pages = recordImagePages(rows);
    expect(pages.map((page) => page.length)).toEqual([18, 18, 4]);
    expect(pages.flat()).toEqual(rows);
    expect(recordImagePages([])).toEqual([]);
  });
});
