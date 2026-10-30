import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/data';

export async function GET(request: NextRequest) {
  const locale =
    request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'ko';
  const child = request.nextUrl.searchParams.get('child') || '';
  const { db } = await requireUser(locale);
  const { data, error } = await db
    .from('child_app_icons')
    .select('token')
    .eq('child_id', child)
    .maybeSingle();
  if (error) return new Response(null, { status: 400 });
  // RLS limits this preference to children the current caregiver can read.
  // Keep the personal manifest on subsequent app launches as well.
  // Use a relative Location: Next's internal origin may be localhost behind
  // the LAN/Vercel proxy, which would lose the user's session on redirect.
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: `/${locale}/install?child=${encodeURIComponent(child)}&ready=1${request.nextUrl.searchParams.has('error') ? '&error=photo' : ''}`,
    },
  });
  response.cookies.set('podoong-app-icon', data?.token || '', {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: data ? 31536000 : 0,
  });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
