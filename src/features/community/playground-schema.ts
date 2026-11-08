import { z } from 'zod';
const member = z.object({
  id: z.string(),
  nickname: z.string().max(121),
  family_name: z.string().max(60),
  child_name: z.string().max(60),
  status: z.string().max(80),
  sex: z.string(),
  age_days: z.number().int().nonnegative(),
  x: z.number(),
  y: z.number(),
});
export const playgroundSchema = z.object({
  day: z.iso.date(),
  timezone: z.string(),
  expires_at: z.iso.datetime({ offset: true }),
  width: z.number().int().min(680),
  min_x: z.number(),
  max_x: z.number(),
  height: z.number().int().positive(),
  population: z.number().int().nonnegative(),
  first_family: z.boolean().default(false),
  left: z.number(),
  right: z.number(),
  own: member,
  members: z.array(member).max(150),
});
