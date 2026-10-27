import { z } from 'zod';
export const childServices = ['sleep', 'diaper', 'growth', 'activity'] as const;
export type ChildService = (typeof childServices)[number];
export function isChildService(value: string): value is ChildService {
  return childServices.includes(value as ChildService);
}
const amount = (max: number) =>
  z
    .union([z.literal(''), z.coerce.number().positive().max(max)])
    .default('')
    .transform((value) => (value === '' ? null : value));
export const activityKinds = [
  'bath',
  'hospital',
  'temperature',
  'medication',
  'snack',
  'play',
  'tummy',
] as const;
const base = z.object({
  id: z.uuid(),
  childId: z.uuid(),
  service: z.enum(childServices),
  occurredAt: z.iso.datetime({ offset: true }),
  endedAt: z
    .union([z.literal(''), z.iso.datetime({ offset: true })])
    .default('')
    .transform((value) => value || null),
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
  note: z.string().max(2000).default(''),
  title: z.string().trim().max(200).default(''),
  temperature: amount(45),
  medicine: z.string().trim().max(200).default(''),
  dose: amount(10000),
  doseUnit: z
    .enum(['', 'ml', 'mg', 'g', 'tablet', 'drop', 'packet'])
    .default(''),
  activityDuration: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(1440)])
    .default('')
    .transform((v) => (v === '' ? null : v)),
  height: amount(250),
  weight: amount(200),
  head: amount(100),
  color: z
    .enum(['', 'yellow', 'green', 'brown', 'red', 'black', 'white', 'other'])
    .default(''),
  texture: z.enum(['', 'watery', 'soft', 'firm', 'other']).default(''),
  version: z
    .union([z.literal(''), z.coerce.number().int().positive()])
    .default('')
    .transform((value) => (value === '' ? null : value)),
});
export const childRecordSchema = z
  .discriminatedUnion('service', [
    base.extend({
      service: z.literal('sleep'),
      kind: z.enum(['nap', 'night']),
    }),
    base.extend({
      service: z.literal('diaper'),
      kind: z.enum(['wet', 'dirty', 'mixed', 'dry']),
    }),
    base.extend({
      service: z.literal('growth'),
      kind: z.enum(['measurement', 'observation']),
    }),
    base.extend({
      service: z.literal('activity'),
      kind: z.enum(activityKinds),
    }),
  ])
  .refine(
    (v) =>
      v.service !== 'activity' ||
      v.kind !== 'temperature' ||
      (v.temperature !== null && v.temperature >= 30),
  )
  .refine(
    (v) =>
      v.service !== 'activity' ||
      v.kind !== 'medication' ||
      (v.medicine.length > 0 &&
        ((v.dose === null && v.doseUnit === '') ||
          (v.dose !== null && v.doseUnit !== ''))),
  )
  .refine(
    (value) =>
      value.service !== 'sleep' ||
      !value.endedAt ||
      Date.parse(value.endedAt) >= Date.parse(value.occurredAt),
  )
  .refine(
    (value) =>
      value.service !== 'growth' ||
      (value.kind === 'measurement'
        ? value.height !== null || value.weight !== null || value.head !== null
        : true),
  );
export function imageType(
  bytes: Uint8Array,
): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    )
  )
    return 'image/png';
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
