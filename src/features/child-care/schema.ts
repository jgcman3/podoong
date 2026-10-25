import { z } from 'zod';
export const childServices = ['sleep', 'diaper', 'growth'] as const;
export type ChildService = (typeof childServices)[number];
export function isChildService(value: string): value is ChildService {
  return childServices.includes(value as ChildService);
}
const amount = (max: number) =>
  z
    .union([z.literal(''), z.coerce.number().positive().max(max)])
    .default('')
    .transform((value) => (value === '' ? null : value));
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
  ])
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
        : value.title.length > 0),
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
