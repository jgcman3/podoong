import { appManifest } from '@/features/install/manifest';

export async function GET(request: Request) {
  const locale =
    new URL(request.url).searchParams.get('locale') === 'en' ? 'en' : 'ko';
  return Response.json(appManifest(locale), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
