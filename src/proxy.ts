import { createServerClient } from '@supabase/ssr';
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
const intl = createMiddleware(routing);
export async function proxy(request: NextRequest) {
  let response = request.nextUrl.pathname.startsWith('/auth/')
    ? NextResponse.next({ request })
    : intl(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = request.nextUrl.pathname.startsWith('/auth/')
            ? NextResponse.next({ request })
            : intl(request);
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          response.headers.set('Cache-Control', 'private, no-store');
        },
      },
    });
    await supabase.auth.getClaims();
  }
  return response;
}
export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
