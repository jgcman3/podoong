import 'server-only';
import { z } from 'zod';
import type { CareContext } from '@/lib/data';
import type { Playground } from './friend-world-model';
const member = z.object({
  id: z.string(),
  nickname: z.string().max(121),
  family_name: z.string().max(60),
  child_name: z.string().max(60),
  status: z.string().max(80),
  sex: z.string(),
  age_days: z.number().int().nonnegative(),
  x: z.number(),
  y: z.number(),
});
const schema = z.object({
  day: z.iso.date(),
  timezone: z.string(),
  expires_at: z.iso.datetime({ offset: true }),
  width: z.number().int().min(680),
  min_x: z.number(),
  max_x: z.number(),
  height: z.number().int().positive(),
  population: z.number().int().nonnegative(),
  left: z.number(),
  right: z.number(),
  own: member,
  members: z.array(member).max(150),
});
export async function loadPlayground(
  context: Pick<CareContext, 'db' | 'child'>,
  viewport?: { left: number; right: number; day: string },
): Promise<Playground> {
  const result = await context.db.rpc('parenting_playground', {
    p_child: context.child.id,
    ...(viewport
      ? { p_left: viewport.left, p_right: viewport.right, p_day: viewport.day }
      : {}),
  });
  if (result.error) throw Error('Playground unavailable');
  return schema.parse(result.data);
}
