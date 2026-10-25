import { z } from 'zod';
export const residenceSchema = z.object({
  familyId: z.uuid(),
  childId: z.uuid(),
  regionCode: z.union([z.literal(''), z.string().regex(/^\d{10}$/)]),
  version: z.coerce.number().int().nonnegative(),
});
