import sharp from 'sharp';
import { z } from 'zod';
import {
  diaryLinkClient,
  diaryLinkPhotoClient,
  validDiaryToken,
} from '@/features/growth-community/public-link';
export const dynamic = 'force-dynamic';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  const { token, id } = await params;
  const headers = {
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!validDiaryToken(token) || !z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const db = diaryLinkClient(token);
  const { data, error } = await db
    .rpc('diary_link_photo', { p_token: token, p_photo: id })
    .maybeSingle();
  if (error || !data) return new Response(null, { status: 404, headers });
  // Hosted Storage may reject the anonymous request even after the RPC
  // authorizes it. Read only the exact path returned by that authorization.
  const storage = diaryLinkPhotoClient();
  if (!storage) return new Response(null, { status: 503, headers });
  const file = await storage.storage
    .from('child-care-photos')
    .download(data.path);
  if (file.error || !file.data)
    return new Response(null, { status: 404, headers });
  try {
    const image = await sharp(Buffer.from(await file.data.arrayBuffer()), {
      limitInputPixels: 60000000,
    })
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    return new Response(new Uint8Array(image), {
      headers: { ...headers, 'Content-Type': 'image/webp' },
    });
  } catch {
    return new Response(null, { status: 422, headers });
  }
}
