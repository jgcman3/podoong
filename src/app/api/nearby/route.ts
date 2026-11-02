import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { nearbySummary } from '@/features/community/nearby.server';
const schema = z
  .object({
    lat: z.number().finite().min(33).max(39),
    lon: z.number().finite().min(124).max(132),
  })
  .strict();
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
  // Coordinates stay out of URLs, logs, database rows, analytics and shared cache keys.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') ?? request.nextUrl.host;
  let sameOrigin = false;
  try {
    const source = new URL(origin ?? '');
    sameOrigin =
      ['http:', 'https:'].includes(source.protocol) && source.host === host;
  } catch {
    /* Missing or malformed Origin is rejected. */
  }
  if (!sameOrigin)
    return NextResponse.json({ ok: false }, { status: 403, headers });
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ ok: false }, { status: 400, headers });
  return NextResponse.json(
    { ok: true, summary: await nearbySummary(parsed.data) },
    { headers },
  );
}
