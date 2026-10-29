import { createClient } from 'npm:@supabase/supabase-js@2.100.0';
import webpush from 'npm:web-push@3.6.7';
import { deliverFeedingPush } from '../_shared/feeding-push.mjs';

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
    const count = await deliverFeedingPush(
      db,
      token,
      async (subscription, payload) => {
        const notification = webpush.generateRequestDetails(
          subscription,
          JSON.stringify(payload),
          {
            TTL: 300,
            urgency: 'normal',
            vapidDetails: {
              subject: 'mailto:jgcman3@gmail.com',
              publicKey,
              privateKey,
            },
          },
        );
        const response = await fetch(notification.endpoint, {
          method: 'POST',
          headers: notification.headers,
          body: notification.body,
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        });
        await response.body?.cancel();
        return response.status;
      },
    );
    return Response.json(count);
  } catch (error) {
    return new Response(null, {
      status:
        error instanceof Error && error.message === 'unauthorized' ? 401 : 503,
    });
  }
});
