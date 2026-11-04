import { redirect } from 'next/navigation';
import type { InstallProps } from '@/features/install/page';

export default async function Install({ params, searchParams }: InstallProps) {
  const { locale } = await params;
  const query = await searchParams;
  const target = new URLSearchParams({ install: '1' });
  for (const key of ['child', 'error', 'ready'] as const)
    if (query[key]) target.set(key, query[key]);
  redirect(`/${locale}/today?${target}`);
}
