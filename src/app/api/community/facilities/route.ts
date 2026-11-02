import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadCare } from '@/lib/data';
import { residenceRegions } from '@/features/family/residence-regions';
import { facilityKinds } from '@/features/community/facility-options';
import { loadFacilityRows } from '@/features/community/facility-listing.server';

const schema = z.object({
  locale: z.enum(['ko', 'en']),
  childId: z.uuid(),
  kind: z.enum(facilityKinds.map(([id]) => id)),
  page: z.coerce.number().int().min(1).max(2000),
  place: z
    .string()
    .regex(/^(\d{10})?$/)
    .default(''),
  specialty: z.enum(['pediatrics', 'all']).default('pediatrics'),
  open: z.enum(['0', '1']).default('0'),
  diaper: z.enum(['0', '1']).default('0'),
});
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  const parsed = schema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json({ ok: false }, { status: 400, headers });
  const input = parsed.data;
  let context;
  try {
    context = await loadCare(input.locale, input.childId, []);
  } catch {
    return NextResponse.json({ ok: false }, { status: 401, headers });
  }
  if (
    context.child.id !== input.childId ||
    context.family.residence_country_code !== 'KR'
  )
    return NextResponse.json({ ok: false }, { status: 403, headers });
  const selected = input.place
    ? residenceRegions.find((region) => region.code === input.place)
    : undefined;
  if (input.place && !selected)
    return NextResponse.json({ ok: false }, { status: 400, headers });
  const area = selected
    ? selected.fullName.split(' ').slice(0, -1).join(' ')
    : (context.family.residence_city ?? '');
  const referenceArea =
    selected?.fullName ??
    [context.family.residence_city, context.family.residence_locality]
      .filter(Boolean)
      .join(' ');
  try {
    const result = await loadFacilityRows({
      kind: input.kind,
      area,
      referenceArea,
      locale: input.locale,
      page: input.page,
      query: {
        open: input.open,
        diaper: input.diaper,
        specialty: input.specialty,
      },
    });
    if (result.unavailable)
      return NextResponse.json({ ok: false }, { status: 503, headers });
    return NextResponse.json(
      {
        ok: true,
        facilities: result.facilities,
        total: result.total,
        holiday: result.holiday,
        asOf: result.asOf,
      },
      { headers },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
