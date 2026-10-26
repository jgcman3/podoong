import { z } from 'zod';
import { createClient, configured } from '@/lib/supabase/server';
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
  const photo = await db.rpc('growth_diary_photo', { p_id: id }).maybeSingle();
  if (photo.error || !photo.data)
    return new Response(null, { status: 404, headers });
  const file = await db.storage
    .from('child-care-photos')
    .download(photo.data.path);
  if (file.error || !file.data)
    return new Response(null, { status: 404, headers });
  return new Response(file.data, {
    headers: {
      ...headers,
      'Content-Type': photo.data.content_type,
      'Content-Disposition': 'inline',
    },
  });
}
