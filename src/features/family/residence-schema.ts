import { z } from 'zod';
import countries from './country-codes.json';
export const residenceSchema = z
  .object({
    countryCode: z
      .string()
      .refine((v) => v === '' || countries.includes(v))
      .default('KR'),
    familyId: z.uuid(),
    childId: z.uuid(),
    regionCode: z.union([z.literal(''), z.string().regex(/^\d{10}$/)]),
    version: z.coerce.number().int().nonnegative(),
  })
  .refine((v) => !v.regionCode || v.countryCode === 'KR');
