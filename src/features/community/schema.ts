import { z } from 'zod';
export const communityActionSchema = z.enum([
  'post',
  'comment',
  'delete-post',
  'delete-comment',
  'reaction',
  'bookmark',
  'report',
  'block',
  'unblock',
  'hide',
  'unhide',
  'restrict',
  'unrestrict',
  'notice',
  'resolve',
  'delete-photo',
]);
export type CommunityCommand = z.infer<typeof communityActionSchema>;
