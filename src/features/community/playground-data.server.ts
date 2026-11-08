import 'server-only';
import { playgroundSchema } from './playground-schema';
import type { CareContext } from '@/lib/data';
import type { Playground } from './friend-world-model';
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
  return playgroundSchema.parse(result.data);
}
