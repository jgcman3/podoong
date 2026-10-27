'use server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export async function manageDiaryLink(
  child: string,
  action: 'get' | 'create' | 'revoke' | 'rotate',
) {
  if (
    !z.uuid().safeParse(child).success ||
    !['get', 'create', 'revoke', 'rotate'].includes(action)
  )
    return { error: true as const };
  const db = await createClient();
  const { data, error } = await db.rpc('manage_child_diary_link', {
    p_child: child,
    p_action: action,
  });
  if (error) return { error: true as const };
  return { token: data ?? null };
}
