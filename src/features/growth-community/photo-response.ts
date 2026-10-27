import sharp from 'sharp';
import { z } from 'zod';
import { createClient, configured } from '@/lib/supabase/server';

export async function diaryPhotoResponse(
  request: Request,
  id: string,
  community: boolean,
) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!configured()) return new Response(null, { status: 503, headers });
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return new Response(null, { status: 401, headers });
  const photo = community
    ? await db.rpc('growth_diary_photo', { p_id: id }).maybeSingle()
    : await db
        .from('child_record_photos')
        .select('path,content_type')
        .eq('id', id)
        .maybeSingle();
  if (photo.error || !photo.data)
    return new Response(null, { status: 404, headers });

  const requestedSize = new URL(request.url).searchParams.get('size');
  const size =
    requestedSize === '1600' ? 1600 : requestedSize === '480' ? 480 : null;
  const thumbnail = size !== null;
  const etag = `"${id}-${size}-webp-v1"`;
  // Always authorize before revalidation: private/revoked photos must not get 304.
  const imageHeaders = thumbnail
    ? {
        ...headers,
        'Cache-Control': 'private, no-cache',
        ETag: etag,
        Vary: 'Cookie',
      }
    : headers;
  if (thumbnail && request.headers.get('if-none-match') === etag)
    return new Response(null, { status: 304, headers: imageHeaders });
  const file = await db.storage
    .from('child-care-photos')
    .download(photo.data.path);
  if (file.error || !file.data)
    return new Response(null, { status: community ? 404 : 503, headers });
  if (!thumbnail)
    return new Response(file.data, {
      headers: {
        ...imageHeaders,
        'Content-Type': photo.data.content_type,
        'Content-Disposition': 'inline',
      },
    });
  try {
    const bytes = await sharp(Buffer.from(await file.data.arrayBuffer()), {
      limitInputPixels: 60000000,
    })
      .rotate()
      .resize(size!, size!, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: size === 1600 ? 90 : 76 })
      .toBuffer();
    return new Response(new Uint8Array(bytes), {
      headers: { ...imageHeaders, 'Content-Type': 'image/webp' },
    });
  } catch {
    // Older uploaded images may not decode; keep their existing display behavior.
    return new Response(file.data, {
      headers: { ...headers, 'Content-Type': photo.data.content_type },
    });
  }
}
