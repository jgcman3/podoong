import { createClient } from '@/lib/supabase/server';
import { usageInput } from '@/features/admin/usage';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const done = (status: number) => new Response(null, { status, headers });
  if (
    request.headers.get('dnt') === '1' ||
    request.headers
      .get('cookie')
      ?.split(';')
      .some((part) => part.trim() === 'podoong-usage=off')
  )
    return done(204);
  const allowedOrigins = new Set([new URL(request.url).origin]);
  // Next may expose an internal localhost URL behind the configured public origin.
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL)
      allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  } catch {
    /* Invalid configuration never adds an allowed origin. */
  }
  if (!allowedOrigins.has(request.headers.get('origin') ?? ''))
    return done(403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return done(415);
  if (Number(request.headers.get('content-length') || 0) > 128)
    return done(413);
  try {
    const reader = request.body?.getReader();
    if (!reader) return done(400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done: ended, value } = await reader.read();
      if (ended) break;
      size += value.byteLength;
      if (size > 128) {
        await reader.cancel();
        return done(413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const body = new TextDecoder().decode(bytes);
    const parsed = usageInput.safeParse(JSON.parse(body));
    if (!parsed.success) return done(400);
    const db = await createClient();
    const { error } =
      'screen' in parsed.data
        ? await db.rpc('record_service_page_view', {
            p_screen: parsed.data.screen,
          })
        : await db.rpc('record_service_action', {
            p_action: parsed.data.action,
          });
    return done(error ? 403 : 204);
  } catch {
    return done(400);
  }
}
