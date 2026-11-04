import { appManifest } from '@/features/install/manifest';
import { findIcon } from '@/features/install/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!(await findIcon(token))) return new Response(null, { status: 404 });
  const locale =
    new URL(request.url).searchParams.get('locale') === 'en' ? 'en' : 'ko';
  const value = appManifest(locale, token);
  return Response.json(value, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
