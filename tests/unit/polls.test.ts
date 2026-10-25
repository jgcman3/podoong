import { describe, expect, it } from 'vitest';
import { examplePolls } from '@/features/polls/examples';
describe('poll previews', () => {
  it('shows a bilingual current question and three past questions across a year boundary', () => {
    const polls = examplePolls('2026-01-01');
    expect(polls.map((poll) => poll.day)).toEqual([
      '2026-01-01',
      '2025-12-31',
      '2025-12-30',
      '2025-12-29',
    ]);
    expect(polls.every((poll) => poll.question_ko && poll.question_en)).toBe(
      true,
    );
    expect(polls.every((poll) => poll.id.startsWith('example-'))).toBe(true);
    expect(polls[0].opens_at).toBe('2025-12-31T15:00:00.000Z');
  });
});
