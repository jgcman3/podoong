import { z } from 'zod';
import { createClient, configured } from '@/lib/supabase/server';
import { communityStorage } from '@/features/community/storage';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  };
  if (!configured()) return new Response(null, { status: 503, headers });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 404, headers });
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return new Response(null, { status: 401, headers });
  const { data: photo, error } = await db
    .from('community_photos')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !photo) return new Response(null, { status: 404, headers });
  const storage = communityStorage();
  if (!storage) return new Response(null, { status: 503, headers });
  const downloaded = await storage.download(photo.path);
  if (downloaded.error || !downloaded.data)
    return new Response(null, { status: 503, headers });
  return new Response(downloaded.data, {
    headers: {
      ...headers,
      'Content-Type': photo.content_type,
      'Content-Disposition': 'inline',
    },
  });
}
