import { z } from 'zod';

const naverResponse = z.object({
  resultcode: z.literal('00'),
  response: z.object({
    id: z.string().min(1).max(255),
    nickname: z.unknown().optional(),
  }),
});

// Supabase expects a top-level subject. Naver nests it under response.id.
// Email and demographic data are unnecessary for the app's identity model.
export function naverSubject(
  payload: unknown,
): { sub: string; name?: string } | null {
  const result = naverResponse.safeParse(payload);
  if (!result.success) return null;
  const nickname = result.data.response.nickname;
  const name =
    typeof nickname === 'string'
      ? nickname.trim().replace(/\s+/g, ' ').slice(0, 60)
      : '';
  return { sub: result.data.response.id, ...(name ? { name } : {}) };
}
