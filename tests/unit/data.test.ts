import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixtures = vi.hoisted(() => ({
  rpc: vi.fn(),
  jobs: vi.fn(),
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
    from: () => ({ select: () => ({ eq: () => ({ limit: fixtures.jobs }) }) }),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
import { requireUser } from '@/lib/data';
describe('account status during staged database upgrades', () => {
  beforeEach(() => {
    fixtures.configured.mockReturnValue(true);
    fixtures.rpc.mockResolvedValue({ data: true, error: null });
    fixtures.jobs.mockResolvedValue({ data: [], error: null });
  });
  it('keeps existing sign-in working when both B4 function and queue are absent', async () => {
    fixtures.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    fixtures.jobs.mockResolvedValue({
      data: null,
      error: { code: 'PGRST205' },
    });
    await expect(requireUser('ko')).resolves.toMatchObject({
      user: { id: 'fixture-user' },
    });
  });
  it('checks the queue if the function is absent but the queue exists', async () => {
    fixtures.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    fixtures.jobs.mockResolvedValue({
      data: [{ id: 'pending-job' }],
      error: null,
    });
    await expect(requireUser('ko')).rejects.toThrow(
      'redirect:/ko/login?notice=deletion-requested',
    );
  });
  it('allows an active account when the queue has no deletion request', async () => {
    fixtures.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await expect(requireUser('ko')).resolves.toMatchObject({
      user: { id: 'fixture-user' },
    });
  });
  it('still blocks accounts marked inactive by the database', async () => {
    fixtures.rpc.mockResolvedValue({ data: false, error: null });
    await expect(requireUser('en')).rejects.toThrow(
      'redirect:/en/login?notice=deletion-requested',
    );
  });
  it('does not bypass RPC permission or connection errors', async () => {
    fixtures.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(requireUser('ko')).rejects.toThrow(
      'Account status unavailable',
    );
  });
  it('does not bypass queue permission or connection errors', async () => {
    fixtures.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    fixtures.jobs.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(requireUser('ko')).rejects.toThrow(
      'Account status unavailable',
    );
  });
});
