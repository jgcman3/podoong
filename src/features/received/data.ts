import 'server-only';
import type { CareContext } from '@/lib/data';
export type ReceivedKind = 'gift' | 'allowance';
export type ReceivedCursor = { at: string; id: string };
export async function loadReceivedRecords(
  context: CareContext,
  kind: ReceivedKind,
  cursor?: ReceivedCursor,
  sender?: string,
) {
  let query = context.db
    .from('child_records')
    .select(
      'id,kind,title,sender_name,received_amount,received_currency,occurred_at,record_timezone,child_record_photos(id)',
    )
    .eq('child_id', context.child.id)
    .eq('service', 'activity')
    .eq('kind', kind)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(21);
  if (sender !== undefined) query = query.eq('sender_name', sender);
  if (cursor)
    query = query.or(
      `occurred_at.lt.${cursor.at},and(occurred_at.eq.${cursor.at},id.lt.${cursor.id})`,
    );
  const result = await query;
  if (result.error) throw new Error('Received records unavailable');
  const items = result.data.slice(0, 20);
  return { items, hasMore: result.data.length > 20 };
}
export type ReceivedPage = Awaited<ReturnType<typeof loadReceivedRecords>>;
export async function loadReceivedOverview(context: CareContext) {
  const [gifts, allowance] = await Promise.all([
    context.db.rpc('received_gift_senders', { p_child: context.child.id }),
    context.db.rpc('received_allowance_totals', { p_child: context.child.id }),
  ]);
  if (gifts.error || allowance.error)
    throw new Error('Received summary unavailable');
  return { gifts: gifts.data, allowance: allowance.data };
}
export type ReceivedOverview = Awaited<ReturnType<typeof loadReceivedOverview>>;
