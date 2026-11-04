import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../../src/app/auth/callback/route';
import { LAST_SOCIAL_COOKIE } from '../../src/features/auth/last-social';
const exchange = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase/server', () => ({
  configured: () => true,
  createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }),
}));
afterEach(() => vi.resetAllMocks());
function callback(query: string) {
  return GET(
    new NextRequest(
      `https://example.test/auth/callback?code=test-code&${query}`,
    ),
  );
}
it('remembers a successful social login with a persistent private cookie', async () => {
  exchange.mockResolvedValue({ error: null });
  const response = await callback('provider=naver');
  expect(response.cookies.get(LAST_SOCIAL_COOKIE)).toMatchObject({
    value: 'naver',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 31536000,
  });
});
it('does not replace the previous social hint when login fails', async () => {
  exchange.mockResolvedValue({ error: { message: 'expired code' } });
  expect(
    (await callback('provider=kakao')).cookies.has(LAST_SOCIAL_COOKIE),
  ).toBe(false);
});
it('does not count account linking or unknown providers as a login', async () => {
  exchange.mockResolvedValue({ error: null });
  expect((await callback('')).cookies.has(LAST_SOCIAL_COOKIE)).toBe(false);
  expect(
    (await callback('provider=unknown')).cookies.has(LAST_SOCIAL_COOKIE),
  ).toBe(false);
});
