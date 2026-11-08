import { describe, expect, it } from 'vitest';
import { playgroundSchema } from '@/features/community/playground-schema';

const own = { id: 'own-test', nickname: 'Test', family_name: 'Family', child_name: 'Baby', status: '', sex: 'female', age_days: 100, x: 0, y: 355 };
const world = { day: '2026-11-08', timezone: 'Asia/Seoul', expires_at: '2026-11-08T15:00:00Z', width: 680, min_x: -340, max_x: 340, height: 520, population: 1, left: -340, right: 340, own, members: [] };
describe('playground response validation', () => {
  it('keeps the playground available before the optional welcome field reaches the database', () => {
    expect(playgroundSchema.parse(world).first_family).toBe(false);
    expect(playgroundSchema.parse({ ...world, first_family: true }).first_family).toBe(true);
  });
  it('still rejects malformed core playground data', () => {
    expect(playgroundSchema.safeParse({ ...world, own: null }).success).toBe(false);
  });
});
