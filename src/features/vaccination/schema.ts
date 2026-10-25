import { z } from 'zod';
import { vaccines } from './copy';
const date = z
  .union([z.literal(''), z.iso.date()])
  .default('')
  .transform((v) => v || null);
export const vaccinationSchema = z
  .object({
    id: z.uuid(),
    childId: z.uuid(),
    vaccine: z.enum(vaccines),
    custom: z.string().trim().max(120).default(''),
    dose: z
      .union([z.literal(''), z.coerce.number().int().min(1).max(10)])
      .default('')
      .transform((v) => (v === '' ? null : v)),
    season: z.string().trim().default(''),
    status: z.enum(['planned', 'completed']),
    scheduled: date,
    completed: date,
    clinic: z.string().trim().max(200).default(''),
    note: z.string().max(2000).default(''),
    timezone: z.string().min(1).max(100),
    version: z
      .union([z.literal(''), z.coerce.number().int().positive()])
      .default('')
      .transform((v) => (v === '' ? null : v)),
  })
  .refine((v) => v.vaccine !== 'other' || v.custom.length > 0)
  .refine(
    (v) =>
      v.vaccine !== 'influenza' ||
      !v.season ||
      (/^\d{4}-\d{4}$/.test(v.season) &&
        Number(v.season.slice(5)) === Number(v.season.slice(0, 4)) + 1),
  )
  .refine((v) => (v.status === 'planned' ? !!v.scheduled : !!v.completed));
