import { NextRequest, NextResponse } from 'next/server';
import { createClient, configured } from '@/lib/supabase/server';
import { isLocale, safeReturnPath } from '@/lib/domain';
export async function GET(request: NextRequest) {
  const rawLocale = request.nextUrl.searchParams.get('locale');
  const locale = rawLocale && isLocale(rawLocale) ? rawLocale : 'ko';
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const next = safeReturnPath(request.nextUrl.searchParams.get('next'), locale);
  const code = request.nextUrl.searchParams.get('code');
  if (code && configured()) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(
    new URL(
      `/${locale}/login?error=auth&next=${encodeURIComponent(next)}`,
      origin,
    ),
  );
}
