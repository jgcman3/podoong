import { naverSubject } from '@/features/auth/naver-profile';

const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  const authorization = request.headers.get('authorization');
  if (
    !authorization ||
    !/^Bearer [A-Za-z0-9._~+\/-]+=*$/i.test(authorization) ||
    authorization.length > 8192
  ) {
    return Response.json({ error: 'invalid_token' }, { status: 401, headers });
  }
  try {
    const upstream = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: authorization },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!upstream.ok)
      return Response.json(
        { error: 'invalid_token' },
        { status: 401, headers },
      );
    const subject = naverSubject(await upstream.json());
    if (!subject)
      return Response.json(
        { error: 'invalid_profile' },
        { status: 502, headers },
      );
    return Response.json(subject, { headers });
  } catch {
    return Response.json(
      { error: 'provider_unavailable' },
      { status: 502, headers },
    );
  }
}
