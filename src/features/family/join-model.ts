import { z } from 'zod';

export function invitationToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (/^[a-f0-9]{64}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    return (
      url.pathname.match(/^\/(?:ko|en)\/invite\/([a-f0-9]{64})\/?$/)?.[1] ??
      null
    );
  } catch {
    return null;
  }
}

export const familyJoinPreview = z.object({
  target: z.object({
    id: z.uuid(),
    name: z.string(),
    child_name: z.string(),
    role: z.enum(['editor', 'viewer']),
  }),
  sources: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      role: z.enum(['owner', 'editor', 'viewer']),
      other_members: z.number().int().nonnegative(),
      children: z.array(z.object({ id: z.uuid(), name: z.string() })),
    }),
  ),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  blocked: z.boolean(),
});
