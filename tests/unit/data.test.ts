import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixtures = vi.hoisted(() => ({
  rpc: vi.fn(),
  configured: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  configured: fixtures.configured,
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'fixture-user' } },
        error: null,
      }),
      getClaims: async () => ({
        data: { claims: { sub: 'fixture-user', amr: [] } },
        error: null,
      }),
    },
    rpc: fixtures.rpc,
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
import { requireUser } from '@/lib/data';
describe('account status access boundary', () => {
  beforeEach(() => {
    fixtures.configured.mockReturnValue(true);
    fixtures.rpc.mockResolvedValue({ data: true, error: null });
  });
  it('allows an active account', async () => {
    await expect(requireUser('ko')).resolves.toMatchObject({
      user: { id: 'fixture-user' },
    });
  });
  it.each(['PGRST202', '42501', '08006'])(
    'fails closed on account status error %s',
    async (code) => {
      fixtures.rpc.mockResolvedValue({ data: null, error: { code } });
      await expect(requireUser('ko')).rejects.toThrow(
        'Account status unavailable',
      );
    },
  );
  it('still blocks accounts marked inactive by the database', async () => {
    fixtures.rpc.mockResolvedValue({ data: false, error: null });
    await expect(requireUser('en')).rejects.toThrow(
      'redirect:/en/login?notice=deletion-requested',
    );
  });
});
