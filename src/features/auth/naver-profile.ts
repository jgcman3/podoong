import { z } from 'zod';

const naverResponse = z.object({
  resultcode: z.literal('00'),
  response: z.object({ id: z.string().min(1).max(255) }),
});

// Supabase expects a top-level subject. Naver nests it under response.id.
// Email and demographic data are unnecessary for the app's identity model.
export function naverSubject(payload: unknown): { sub: string } | null {
  const result = naverResponse.safeParse(payload);
  return result.success ? { sub: result.data.response.id } : null;
}
