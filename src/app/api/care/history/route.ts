import { NextRequest, NextResponse } from 'next/server';
import { loadQuickDay } from '@/features/care/quick-history-actions';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const result = await loadQuickDay({
    locale: query.get('locale') ?? '',
    childId: query.get('childId') ?? '',
    day: query.get('day') ?? '',
  });
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
