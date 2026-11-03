import { beforeEach, expect, test, vi } from 'vitest';
import { usageAllowed, usageInput, usageScreen } from '@/features/admin/usage';
import { pageViewsSchema } from '@/features/admin/model';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ rpc }),
}));
import { POST } from '@/app/api/usage/route';
beforeEach(() => rpc.mockReset().mockResolvedValue({ error: null }));
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://podoong.com/api/usage', {
    method: 'POST',
    headers: {
      origin: 'https://podoong.com',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
test('only service screens map to fixed categories, excluding signup and shared links', () => {
  expect(usageScreen('/ko/today?child=private-token')).toBe('today');
  expect(usageScreen('/en/community/diaries')).toBe('diary');
  expect(usageScreen('/ko/community/posts/private-id')).toBe('community');
  for (const path of [
    '/ko/onboarding',
    '/ko/share/diary/private-token',
    '/ko/admin/analytics',
    '/ko/intro',
  ])
    expect(usageScreen(path)).toBeNull();
  expect(
    usageInput.safeParse({ screen: 'today', url: 'private' }).success,
  ).toBe(false);
});
test('browser DNT and local device optout suppress analytics', () => {
  expect(usageAllowed('a=1; podoong-usage=off', '0')).toBe(false);
  expect(usageAllowed('', '1')).toBe(false);
  expect(usageAllowed('', 'yes')).toBe(false);
  expect(usageAllowed('podoong-usage=on', null)).toBe(true);
});
test('API passes only screen enum through authenticated RPC', async () => {
  expect((await POST(request({ screen: 'today' }))).status).toBe(204);
  expect(rpc).toHaveBeenCalledWith('record_service_page_view', {
    p_screen: 'today',
  });
  expect(
    (await POST(request({ screen: 'today', child: 'private' }))).status,
  ).toBe(400);
  expect((await POST(request({ screen: 'x'.repeat(200) }))).status).toBe(413);
  expect(
    (
      await POST(
        request({ screen: 'today' }, { origin: 'https://another.example' }),
      )
    ).status,
  ).toBe(403);
  expect(rpc).toHaveBeenCalledTimes(1);
});
test('API silently ignores opted-out requests and never exposes DB errors', async () => {
  expect(
    (await POST(request({ screen: 'today' }, { cookie: 'podoong-usage=off' })))
      .status,
  ).toBe(204);
  expect((await POST(request({ screen: 'today' }, { dnt: '1' }))).status).toBe(
    204,
  );
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ error: { message: 'private' } });
  const response = await POST(request({ screen: 'today' }));
  expect(response.status).toBe(403);
  expect(await response.text()).toBe('');
});
test('admin screen output accepts zero counts and rejects non-enum dimensions', () => {
  expect(
    pageViewsSchema.parse({
      days: 7,
      timezone: 'Asia/Seoul',
      screens: [{ screen: 'diary', views: 0 }],
    }).screens[0].views,
  ).toBe(0);
  expect(
    pageViewsSchema.safeParse({
      days: 7,
      timezone: 'Asia/Seoul',
      screens: [{ screen: '/private-child', views: 1 }],
    }).success,
  ).toBe(false);
});
