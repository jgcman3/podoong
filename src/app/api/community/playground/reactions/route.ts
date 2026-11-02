import { z } from 'zod';
import { loadFamily } from '@/lib/data';
const headers = { 'Cache-Control': 'private, no-store' };
const base = z.object({
  child: z.uuid(),
  locale: z.enum(['ko', 'en']).default('ko'),
});
export async function GET(request: Request) {
  const query = base
    .extend({ before: z.uuid().optional() })
    .safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success)
    return Response.json({ ok: false }, { status: 400, headers });
  const v = query.data,
    context = await loadFamily(v.locale, v.child);
  if (context.child.id !== v.child)
    return Response.json({ ok: false }, { status: 404, headers });
  const result = await context.db.rpc('playground_reactions', {
    p_child: v.child,
    ...(v.before ? { p_before: v.before } : {}),
  });
  if (result.error)
    return Response.json({ ok: false }, { status: 403, headers });
  return Response.json({ ok: true, inbox: result.data }, { headers });
}
export async function POST(request: Request) {
  const input = base
    .extend({ friend: z.guid(), kind: z.enum(['wave', 'heart', 'comfort']) })
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return Response.json({ ok: false }, { status: 400, headers });
  const v = input.data,
    context = await loadFamily(v.locale, v.child);
  if (context.child.id !== v.child)
    return Response.json({ ok: false }, { status: 404, headers });
  const result = await context.db.rpc('send_playground_reaction', {
    p_child: v.child,
    p_friend: v.friend,
    p_kind: v.kind,
  });
  if (result.error)
    return Response.json(
      { ok: false },
      { status: result.error.code === '42501' ? 403 : 400, headers },
    );
  return Response.json({ ok: true }, { headers });
}
