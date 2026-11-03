import { z } from 'zod';

export const privacyStateSchema = z.object({
  version: z.string(),
  authority: z.boolean(),
  health: z.boolean(),
  publicSharing: z.boolean(),
  neighborhood: z.boolean(),
  childGranted: z.boolean(),
  owner: z.boolean(),
});
export type PrivacyState = z.infer<typeof privacyStateSchema>;
