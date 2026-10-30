import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const child = request.nextUrl.searchParams.get('child');
  if (!child || !/^[a-f0-9-]{36}$/i.test(child))
    return NextResponse.json({ error: 'Invalid child' }, { status: 400 });
  const result = await db.rpc('export_child_data', { p_child: child });
  if (result.error)
    return NextResponse.json({ error: 'Export unavailable' }, { status: 403 });
  const meal = await db
    .from('child_meal_plans')
    .select('*')
    .eq('child_id', child)
    .maybeSingle();
  if (meal.error && meal.error.code !== 'PGRST205')
    return NextResponse.json({ error: 'Export unavailable' }, { status: 503 });
  const payload =
    result.data &&
    typeof result.data === 'object' &&
    !Array.isArray(result.data)
      ? { ...result.data, meal_plan: meal.data ?? null }
      : result.data;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="podoong-records.json"',
      'Cache-Control': 'private, no-store',
    },
  });
}
