import { describe, expect, it, vi, afterEach } from 'vitest';
import { naverSubject } from '../../src/features/auth/naver-profile';

describe('Naver identity normalization', () => {
  it('uses the provider ID without collecting optional demographics or email', () => {
    expect(
      naverSubject({
        resultcode: '00',
        response: {
          id: 'naver-user-123',
          email: 'private@example.test',
          birthday: '01-01',
        },
      }),
    ).toEqual({ sub: 'naver-user-123' });
  });
  it.each([
    null,
    { resultcode: '00', response: { id: '' } },
    { resultcode: '024', response: { id: 'user' } },
  ])('rejects invalid provider profiles', (payload) => {
    expect(naverSubject(payload)).toBeNull();
  });
});

describe('Naver userinfo adapter', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not call the provider without a bearer token', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('../../src/app/api/auth/naver/userinfo/route');
    const response = await GET(
      new Request('http://localhost/api/auth/naver/userinfo'),
    );
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fetches only the fixed provider endpoint and never caches identity data', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ resultcode: '00', response: { id: 'subject-123' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('../../src/app/api/auth/naver/userinfo/route');
    const response = await GET(
      new Request('http://localhost/api/auth/naver/userinfo', {
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
    expect(await response.json()).toEqual({ sub: 'subject-123' });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fetcher).toHaveBeenCalledWith(
      'https://openapi.naver.com/v1/nid/me',
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'error',
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
  });
});
