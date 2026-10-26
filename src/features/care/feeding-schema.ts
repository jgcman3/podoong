import { z } from 'zod';
import { feedingKinds } from './feeding-record';
const uuid = z.uuid();
export const feedingRecordSchema = z
  .object({
    id: uuid,
    childId: uuid,
    kind: z.enum(feedingKinds),
    foodName: z.string().trim().max(200),
    timezone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z
      .union([z.literal(''), z.iso.datetime({ offset: true })])
      .transform((v) => v || null),
    amount: z
      .union([z.literal(''), z.coerce.number().min(0).max(3000)])
      .transform((v) => (v === '' ? null : v)),
    note: z.string().max(2000),
    version: z
      .union([z.literal(''), z.coerce.number().int().positive()])
      .transform((v) => (v === '' ? null : v)),
  })
  .refine(
    (v) => !v.endedAt || Date.parse(v.endedAt) >= Date.parse(v.startedAt),
  );
