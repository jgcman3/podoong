import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/data', () => ({ loadCare: vi.fn() }));
vi.mock('@/features/community/facility-listing.server', () => ({
  loadFacilityRows: vi.fn(),
}));
import { loadCare } from '@/lib/data';
import { loadFacilityRows } from '@/features/community/facility-listing.server';
import { GET } from '@/app/api/community/facilities/route';
const childId = '11111111-1111-4111-8111-111111111111';
const request = (query = '') =>
  new NextRequest(
    `https://example.test/api/community/facilities?locale=ko&childId=${childId}&kind=hospital&page=2${query}`,
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadCare).mockResolvedValue({
    child: { id: childId },
    family: {
      residence_country_code: 'KR',
      residence_city: '서울특별시 용산구',
      residence_locality: '후암동',
    },
  } as Awaited<ReturnType<typeof loadCare>>);
  vi.mocked(loadFacilityRows).mockResolvedValue({
    facilities: [],
    total: 25,
    holiday: false,
    unavailable: false,
    checkedAt: '',
    asOf: '2026-11-02T00:00:00Z',
  });
});
it('requires authentication and never returns upstream or authentication errors', async () => {
  vi.mocked(loadCare).mockRejectedValue(new Error('private error'));
  const response = await GET(request());
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ ok: false });
  expect(loadFacilityRows).not.toHaveBeenCalled();
});
it('rejects a child outside the authenticated family and invalid pagination', async () => {
  vi.mocked(loadCare).mockResolvedValue({
    child: { id: 'different' },
    family: {},
  } as Awaited<ReturnType<typeof loadCare>>);
  expect((await GET(request())).status).toBe(403);
  expect((await GET(request('&page=-1'))).status).toBe(400);
  expect(loadFacilityRows).not.toHaveBeenCalled();
});
it('loads the next page with the same region and open filter and disables response caching', async () => {
  const response = await GET(request('&open=1'));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(loadFacilityRows).toHaveBeenCalledWith({
    kind: 'hospital',
    area: '서울특별시 용산구',
    referenceArea: '서울특별시 용산구 후암동',
    locale: 'ko',
    page: 2,
    query: { open: '1', diaper: '0', specialty: 'pediatrics' },
  });
  expect(await response.json()).toEqual({
    ok: true,
    facilities: [],
    total: 25,
    holiday: false,
    asOf: '2026-11-02T00:00:00Z',
  });
});
it('does not expose upstream failures as a successful empty page', async () => {
  vi.mocked(loadFacilityRows).mockRejectedValue(
    new Error('private service key'),
  );
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false });
});

it('preserves all-specialty selection on subsequent pages and rejects unsupported specialties', async () => {
  expect((await GET(request('&specialty=all&open=1'))).status).toBe(200);
  expect(loadFacilityRows).toHaveBeenCalledWith(
    expect.objectContaining({
      page: 2,
      query: { specialty: 'all', open: '1', diaper: '0' },
    }),
  );
  expect((await GET(request('&specialty=unsupported'))).status).toBe(400);
});
it.each([null, 'US'])(
  'does not query Korean facilities for country %s',
  async (country) => {
    vi.mocked(loadCare).mockResolvedValue({
      child: { id: childId },
      family: { residence_country_code: country },
    } as Awaited<ReturnType<typeof loadCare>>);
    expect((await GET(request())).status).toBe(403);
    expect(loadFacilityRows).not.toHaveBeenCalled();
  },
);

it.each([
  ['', '1'],
  ['&open=0', '0'],
])(
  'defaults to open facilities and preserves explicit opt-out (%s)',
  async (suffix, open) => {
    expect((await GET(request(suffix))).status).toBe(200);
    expect(loadFacilityRows).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ open }),
      }),
    );
  },
);

it.each(['kids-cafe', 'nursing'])(
  'rejects unavailable regional category %s before requesting facility data',
  async (kind) => {
    vi.mocked(loadCare).mockResolvedValue({
      child: { id: childId },
      family: {
        residence_country_code: 'KR',
        residence_city: '경기도 수원시 영통구',
        residence_locality: '영통동',
      },
    } as Awaited<ReturnType<typeof loadCare>>);
    expect((await GET(request('&kind=' + kind))).status).toBe(404);
    expect(loadFacilityRows).not.toHaveBeenCalled();
  },
);
