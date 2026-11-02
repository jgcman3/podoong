import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const email = process.env.PODOONG_LOCAL_DEMO_EMAIL,
    password = process.env.PODOONG_LOCAL_DEMO_PASSWORD,
    child = process.env.PODOONG_LOCAL_DEMO_CHILD;
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.PODUNG_LOCAL_PLAYGROUND_DEMO !== '1' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:55321' ||
    !['localhost', '127.0.0.1'].includes(request.nextUrl.hostname) ||
    !email ||
    !password ||
    !child
  )
    return new NextResponse(null, { status: 404 });
  const db = await createClient();
  const result = await db.auth.signInWithPassword({ email, password });
  if (result.error)
    return new NextResponse('Local demo unavailable', { status: 503 });
  const locale =
    request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ko';
  return NextResponse.redirect(
    new URL(`/${locale}/community/playground?child=${child}`, request.nextUrl.origin),
  );
}
