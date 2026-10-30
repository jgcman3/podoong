import sharp from 'sharp';
import { findIcon, iconStorage } from '@/features/install/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; size: string }> },
) {
  const { token, size } = await params;
  if (!['180', '192', '512'].includes(size))
    return new Response(null, { status: 404 });
  const icon = await findIcon(token);
  if (!icon) return new Response(null, { status: 404 });
  const stored = await iconStorage()
    .storage.from('child-care-photos')
    .download(icon.path);
  if (stored.error || !stored.data) return new Response(null, { status: 404 });
  const bytes = await sharp(Buffer.from(await stored.data.arrayBuffer()))
    .resize(Number(size), Number(size))
    .png()
    .toBuffer();
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
