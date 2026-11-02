import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { communityStorage } from '@/features/community/storage';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    'Cache-Control': 'private, no-cache',
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  };
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const db = await createClient(),
    { data: auth } = await db.auth.getUser();
  if (!auth.user) return new Response(null, { status: 401, headers });
  const photo = await db
    .from('parenting_post_photos')
    .select('path')
    .eq('id', id)
    .maybeSingle();
  if (photo.error || !photo.data)
    return new Response(null, { status: 404, headers });
  const small = new URL(request.url).searchParams.get('size') === '480',
    etag = `"${id}-${small ? '480' : '1600'}"`;
  if (request.headers.get('if-none-match') === etag)
    return new Response(null, {
      status: 304,
      headers: { ...headers, ETag: etag },
    });
  const storage = communityStorage();
  if (!storage) return new Response(null, { status: 503, headers });
  const file = await storage.download(
    small ? photo.data.path.replace('.webp', '-480.webp') : photo.data.path,
  );
  if (file.error || !file.data)
    return new Response(null, { status: 404, headers });
  return new Response(file.data, {
    headers: {
      ...headers,
      ETag: etag,
      'Content-Type': 'image/webp',
      'Content-Disposition': 'inline',
    },
  });
}
