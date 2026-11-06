import { z } from 'zod';
export const communityActionSchema = z.enum([
  'unblock',
  'hide',
  'unhide',
  'restrict',
  'unrestrict',
  'resolve',
]);
export type CommunityCommand = z.infer<typeof communityActionSchema>;
