'use server';
import { z } from 'zod';
import { loadCare } from '@/lib/data';
import { loadReceivedRecords } from './data';
const inputSchema = z.object({
  locale: z.enum(['ko', 'en']),
  childId: z.uuid(),
  kind: z.enum(['gift', 'allowance']),
  sender: z.string().trim().min(1).max(100).optional(),
  cursor: z
    .object({ at: z.iso.datetime({ offset: true }), id: z.uuid() })
    .optional(),
});
export async function moreReceivedRecords(input: z.input<typeof inputSchema>) {
  const v = inputSchema.parse(input);
  const context = await loadCare(v.locale, v.childId, []);
  if (context.child.id !== v.childId) throw new Error('Forbidden');
  return loadReceivedRecords(context, v.kind, v.cursor, v.sender);
}
