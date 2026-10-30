import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Introduction } from '@/features/introduction/page';
import { configured, createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/domain';
export { generateMetadata } from './intro/page';
export default async function Index({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const store = await cookies();
  if (
    configured() &&
    store
      .getAll()
      .some(
        (cookie) =>
          cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'),
      )
  ) {
    const client = await createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user) redirect(`/${locale}/today`);
  }
  return <Introduction locale={locale} />;
}
