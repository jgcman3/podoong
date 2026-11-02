import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
}));
vi.mock('@/features/community/nearby.server', () => ({
  nearbySummary: vi.fn(async () => ({ temperature: 17 })),
}));
import { POST } from '@/app/api/nearby/route';
import { nearbySummary } from '@/features/community/nearby.server';
const request = (data: unknown, origin = 'https://example.test') =>
  new NextRequest('https://example.test/api/nearby', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'fixture' } } });
});
it('requires same origin and sign in before processing position', async () => {
  expect(
    (await POST(request({ lat: 37, lon: 127 }, 'https://other.test'))).status,
  ).toBe(403);
  getUser.mockResolvedValueOnce({ data: { user: null } });
  expect((await POST(request({ lat: 37, lon: 127 }))).status).toBe(401);
  expect(nearbySummary).not.toHaveBeenCalled();
});
it('validates coordinates and marks personalized location responses private and uncacheable', async () => {
  for (const data of [
    { lat: 0, lon: 127 },
    { lat: 37, lon: 200 },
    { lat: '37', lon: 127 },
    { lat: 37, lon: 127, childId: 'private' },
  ])
    expect((await POST(request(data))).status).toBe(400);
  const response = await POST(request({ lat: 37, lon: 127 }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(nearbySummary).toHaveBeenCalledWith({ lat: 37, lon: 127 });
});

it('accepts the real Host behind a local Next proxy without trusting an unrelated Origin', async () => {
  const input = request({ lat: 37, lon: 127 }, 'http://127.0.0.1:3187');
  input.headers.set('host', '127.0.0.1:3187');
  expect((await POST(input)).status).toBe(200);
});
