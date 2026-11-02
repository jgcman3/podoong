import { z } from 'zod';
import { loadFamily } from '@/lib/data';
import { loadPlayground } from '@/features/community/playground-data.server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = z
    .object({
      child: z.uuid(),
      left: z.coerce.number().int().min(-100000000).max(100000000),
      right: z.coerce.number().int().min(-100000000).max(100000000),
      day: z.iso.date(),
      locale: z.enum(['ko', 'en']).default('ko'),
    })
    .refine((v) => v.right >= v.left && v.right - v.left <= 4096)
    .safeParse(Object.fromEntries(url.searchParams));
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!query.success)
    return Response.json({ ok: false }, { status: 400, headers });
  const v = query.data;
  const context = await loadFamily(v.locale, v.child);
  if (context.child.id !== v.child)
    return Response.json({ ok: false }, { status: 404, headers });
  const world = await loadPlayground(context, {
    left: v.left,
    right: v.right,
    day: v.day,
  });
  return Response.json({ ok: true, world }, { headers });
}
