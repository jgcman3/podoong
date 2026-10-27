import { beforeEach, expect, it, vi } from 'vitest';
import sharp from 'sharp';
const mocks = vi.hoisted(() => ({
  metadata: vi.fn(),
  anonymousDownload: vi.fn(),
  serverDownload: vi.fn(),
  serverClient: vi.fn(),
}));
vi.mock('@/features/growth-community/public-link', () => ({
  validDiaryToken: (token: string) => /^[a-f0-9]{64}$/.test(token),
  diaryLinkClient: () => ({
    rpc: () => ({ maybeSingle: mocks.metadata }),
    storage: { from: () => ({ download: mocks.anonymousDownload }) },
  }),
  diaryLinkPhotoClient: mocks.serverClient,
}));
import { GET } from '@/app/api/share/diary/[token]/photos/[id]/route';
const params = {
  token: 'a'.repeat(64),
  id: '10000000-0000-4000-8000-000000000001',
};
const request = () =>
  GET(new Request('http://localhost/api/share/photo'), {
    params: Promise.resolve(params),
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.metadata.mockResolvedValue({
    data: { path: 'authorized/photo.png' },
    error: null,
  });
  mocks.anonymousDownload.mockResolvedValue({
    data: null,
    error: { statusCode: '404' },
  });
  mocks.serverClient.mockReturnValue({
    storage: {
      from: (bucket: string) => {
        expect(bucket).toBe('child-care-photos');
        return { download: mocks.serverDownload };
      },
    },
  });
});
it('serves an authorized photo when anonymous Storage download is denied', async () => {
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#eee' },
  })
    .png()
    .toBuffer();
  mocks.serverDownload.mockResolvedValue({
    data: new Blob([new Uint8Array(bytes)]),
    error: null,
  });
  const response = await request();
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Type')).toBe('image/webp');
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(mocks.serverDownload).toHaveBeenCalledWith('authorized/photo.png');
  expect(mocks.anonymousDownload).not.toHaveBeenCalled();
});
it.each([
  { data: null, error: null },
  { data: null, error: { code: '42501' } },
])(
  'never opens privileged Storage for an invalid/revoked link or unrelated photo',
  async (result) => {
    mocks.metadata.mockResolvedValue(result);
    expect((await request()).status).toBe(404);
    expect(mocks.serverClient).not.toHaveBeenCalled();
  },
);
it('fails closed when the server credential is missing', async () => {
  mocks.serverClient.mockReturnValue(null);
  expect((await request()).status).toBe(503);
  expect(mocks.serverDownload).not.toHaveBeenCalled();
});
