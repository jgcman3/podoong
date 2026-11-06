import { createClient } from 'npm:@supabase/supabase-js@2.100.0';
import webpush from 'npm:web-push@3.6.7';
import { deliverFeedingPush } from '../_shared/feeding-push.mjs';
import { deliverPlaygroundPush } from '../_shared/playground-push.mjs';

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const token = request.headers.get('x-podung-worker-token');
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return new Response(null, { status: 401 });
  const publicKey = Deno.env.get('WEB_PUSH_PUBLIC_KEY'),
    privateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY');
  if (!publicKey || !privateKey) return new Response(null, { status: 503 });
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const diagnostics: Record<string, unknown>[] = [];
    const report = (detail: Record<string, unknown>) => {
      if (diagnostics.length < 20) diagnostics.push(detail);
      console.warn('web_push_diagnostic', detail);
    };
    const send = async (
      subscription: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      },
      payload: Record<string, unknown>,
    ) => {
      let stage = 'encode';
      let responseStatus: number | undefined;
      try {
        const notification = webpush.generateRequestDetails(
          subscription,
          JSON.stringify(payload),
          {
            TTL: 300,
            urgency: 'normal',
            vapidDetails: {
              subject: 'mailto:admin@podoong.com',
              publicKey,
              privateKey,
            },
          },
        );
        stage = 'request';
        const response = await fetch(notification.endpoint, {
          method: 'POST',
          headers: notification.headers,
          body: notification.body,
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        });
        responseStatus = response.status;
        stage = 'response_cleanup';
        await response.body?.cancel();
        return response.status;
      } catch (error) {
        const name = error instanceof Error ? error.name : 'Error';
        report({
          operation: 'transport',
          stage,
          status: responseStatus,
          errorType: [
            'Error',
            'TypeError',
            'TimeoutError',
            'AbortError',
            'NotSupportedError',
          ].includes(name)
            ? name
            : 'Error',
        });
        throw error;
      }
    };
    const feeding = await deliverFeedingPush(db, token, send, report);
    const playground = await deliverPlaygroundPush(db, token, send, report);
    return Response.json({ feeding, playground, diagnostics });
  } catch (error) {
    return new Response(null, {
      status:
        error instanceof Error && error.message === 'unauthorized' ? 401 : 503,
    });
  }
});
