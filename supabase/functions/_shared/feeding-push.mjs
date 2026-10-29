export function validPushEndpoint(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.port &&
      !url.username &&
      !url.password &&
      /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}
export function feedingPushPayload(job) {
  const ko = job.locale === 'ko';
  return {
    title: ko ? '다음 먹이기 시간이에요' : 'Time for the next feed',
    body: ko
      ? '아기의 식사 시간을 확인해 주세요.'
      : 'Check your baby’s next feeding time.',
    tag: `feeding:${job.child_id}`,
    url: `/${ko ? 'ko' : 'en'}/today?child=${job.child_id}`,
  };
}
export async function deliverFeedingPush(db, token, send) {
  const batch = await db.rpc('claim_feeding_push', { p_token: token });
  if (batch.error)
    throw new Error(
      batch.error.code === '42501' ? 'unauthorized' : 'worker unavailable',
    );
  const count = { sent: 0, retry: 0, gone: 0, cancelled: 0 };
  for (const job of batch.data ?? []) {
    let result = 'retry';
    const valid = await db.rpc('validate_feeding_push', {
      p_id: job.id,
      p_lease: job.lease_token,
    });
    if (!valid.error && !valid.data) result = 'cancelled';
    else if (!valid.error) {
      if (!validPushEndpoint(job.endpoint)) result = 'gone';
      else
        try {
          const status = await send(
            {
              endpoint: job.endpoint,
              keys: { p256dh: job.p256dh, auth: job.auth_key },
            },
            feedingPushPayload(job),
          );
          result =
            status >= 200 && status < 300
              ? 'sent'
              : [404, 410].includes(status)
                ? 'gone'
                : 'retry';
        } catch {
          /* Keep endpoint, keys and network errors out of diagnostics. */
        }
    }
    const done = await db.rpc('finish_feeding_push', {
      p_id: job.id,
      p_lease: job.lease_token,
      p_result: result,
    });
    if (done.error) throw new Error('worker unavailable');
    count[result]++;
  }
  return count;
}
