import { beforeEach, describe, expect, it, vi } from 'vitest';
const fixtures = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
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
    from: fixtures.from,
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
import { loadFamily, requireUser } from '@/lib/data';
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

describe('family snapshot loading', () => {
  const child = {
    id: 'c1030000-0000-4000-8000-000000000001',
    family_id: 'b1030000-0000-4000-8000-000000000001',
    name: 'Fixture child',
    birth_date: '2026-01-01',
    sex: 'female',
  };
  const profile = {
    id: 'fixture-user',
    consented_at: '2026-11-01T00:00:00Z',
    timezone: 'Asia/Seoul',
  };
  const privacy = {
    version: 'signup-test',
    authority: true,
    health: true,
    publicSharing: false,
    neighborhood: false,
    childGranted: true,
    owner: true,
  };
  const access = {
    family: { id: child.family_id, name: 'Fixture family' },
    members: [],
    caregivers: [],
    owner: true,
    writable: true,
  };
  const snapshot = { profile, children: [child], child, ...access, privacy };
  beforeEach(() => {
    fixtures.configured.mockReturnValue(true);
    fixtures.rpc.mockReset();
    fixtures.from.mockReset();
    fixtures.rpc.mockImplementation((name: string) => {
      if (name === 'account_active')
        return Promise.resolve({ data: true, error: null });
      if (name === 'privacy_state')
        return Promise.resolve({ data: privacy, error: null });
      return {
        single: async () => ({
          data: name === 'app_family_snapshot' ? snapshot : access,
          error: null,
        }),
      };
    });
    fixtures.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: null }),
        }),
        order: async () => ({
          data: table === 'children' ? [child] : [],
          error: null,
        }),
      }),
    }));
  });
  it('reads family and consent in one remote request after account validation', async () => {
    await expect(loadFamily('ko', child.id)).resolves.toMatchObject({
      profile,
      child,
      children: [child],
      ...access,
      privacy,
      writable: true,
    });
    const familyRequests =
      fixtures.from.mock.calls.length +
      fixtures.rpc.mock.calls.filter(([name]) => name !== 'account_active')
        .length;
    expect(familyRequests).toBe(1);
  });
  it('preserves default-child fallback for malformed URL child IDs', async () => {
    await expect(loadFamily('ko', 'invalid-child')).resolves.toMatchObject({
      child,
    });
    expect(fixtures.rpc).toHaveBeenCalledWith('app_family_snapshot', {});
  });
  it('keeps a missing profile on the onboarding route', async () => {
    fixtures.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        order: async () => ({ data: [child], error: null }),
      }),
    }));
    fixtures.rpc.mockImplementation((name: string) =>
      name === 'account_active'
        ? Promise.resolve({ data: true, error: null })
        : {
            single: async () => ({
              data: { ...snapshot, profile: null },
              error: null,
            }),
          },
    );
    await expect(loadFamily('en')).rejects.toThrow('redirect:/en/onboarding');
  });
});
