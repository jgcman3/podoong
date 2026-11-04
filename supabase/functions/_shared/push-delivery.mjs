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
export async function deliverPushBatch(
  db,
  token,
  send,
  { claim, validate, finish, payload },
) {
  const batch = await db.rpc(claim, { p_token: token });
  if (batch.error)
    throw new Error(
      batch.error.code === '42501' ? 'unauthorized' : 'worker unavailable',
    );
  const count = { sent: 0, retry: 0, gone: 0, cancelled: 0 };
  const jobs = batch.data ?? [];
  let cursor = 0;
  async function drain() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      let result = 'retry';
      const valid = await db.rpc(validate, {
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
              payload(job),
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
      const done = await db.rpc(finish, {
        p_id: job.id,
        p_lease: job.lease_token,
        p_result: result,
      });
      if (done.error) throw new Error('worker unavailable');
      count[result]++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, jobs.length) }, drain));
  return count;
}
