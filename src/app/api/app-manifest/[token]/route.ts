import manifest from '@/app/manifest';
import { findIcon } from '@/features/install/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!(await findIcon(token))) return new Response(null, { status: 404 });
  const value = manifest();
  value.icons = [192, 512].map((size) => ({
    src: `/api/app-icon/${token}/${size}`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: 'any',
  }));
  return Response.json(value, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
