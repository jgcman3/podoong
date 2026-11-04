import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  schedulePushPayload,
  deliverSchedulePush,
} from '../../supabase/functions/_shared/schedule-push.mjs';
const job = {
  id: 'job',
  lease_token: 'lease',
  locale: 'ko',
  day: '2026-11-04',
  item_count: 3,
  endpoint: 'https://fcm.googleapis.com/fcm/send/test',
  p256dh: 'key',
  auth_key: 'auth',
};
it('summarizes the day without names or private plan titles on the lock screen', () => {
  const p = schedulePushPayload(job);
  expect(p.body).toContain('3개');
  expect(p.url).toBe('/ko/calendar?agenda=2026-11-04');
  expect(p.tag).toBe('schedule:2026-11-04');
  const en = schedulePushPayload({ ...job, locale: 'en' });
  expect(en.body).toContain('3 plans');
  expect(en.url).toBe('/en/calendar?agenda=2026-11-04');
});
it('does not send after opt-out or access revocation, and acknowledges cancellation', async () => {
  const rpc = vi.fn(async (name: string) => ({
    data: name === 'claim_schedule_push' ? [job] : false,
    error: null,
  }));
  const send = vi.fn();
  await deliverSchedulePush({ rpc }, 'token', send);
  expect(send).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenLastCalledWith('finish_schedule_push', {
    p_id: 'job',
    p_lease: 'lease',
    p_result: 'cancelled',
  });
});
it('sends a validated daily summary through the shared push transport', async () => {
  const rpc = vi.fn(async (name: string) => ({
    data: name === 'claim_schedule_push' ? [job] : true,
    error: null,
  }));
  const send = vi.fn(async () => 201);
  expect(await deliverSchedulePush({ rpc }, 'token', send)).toEqual({
    sent: 1,
    retry: 0,
    gone: 0,
    cancelled: 0,
  });
  expect(send).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ url: '/ko/calendar?agenda=2026-11-04' }),
  );
});
it('opens agenda notifications in the local calendar', async () => {
  const handlers = new Map();
  const openWindow = vi.fn();
  const showNotification = vi.fn();
  const work: Promise<unknown>[] = [];
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    self: {
      location: { origin: 'https://podoong.example' },
      addEventListener: (n: string, f: unknown) => handlers.set(n, f),
      registration: { showNotification },
      clients: { matchAll: async () => [], openWindow },
      skipWaiting: async () => {},
    },
  });
  handlers.get('push')({
    data: { json: () => schedulePushPayload(job) },
    waitUntil: (p: Promise<unknown>) => work.push(p),
  });
  await Promise.all(work);
  expect(showNotification.mock.calls[0][1].data.url).toBe(
    'https://podoong.example/ko/calendar?agenda=2026-11-04',
  );
  work.length = 0;
  handlers.get('notificationclick')({
    notification: {
      close: () => {},
      data: { url: 'https://podoong.example/ko/calendar?agenda=2026-11-04' },
    },
    waitUntil: (p: Promise<unknown>) => work.push(p),
  });
  await Promise.all(work);
  expect(openWindow).toHaveBeenCalledWith(
    'https://podoong.example/ko/calendar?agenda=2026-11-04',
  );
});
it('drains more than one full schedule batch in the same invocation', async () => {
  let claims = 0;
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === 'claim_schedule_push'
        ? ++claims === 1
          ? Array.from({ length: 10 }, (_, i) => ({ ...job, id: `job-${i}` }))
          : claims === 2
            ? [job]
            : []
        : true,
    error: null,
  }));
  const send = vi.fn(async () => 201);
  expect((await deliverSchedulePush({ rpc }, 'token', send)).sent).toBe(11);
  expect(send).toHaveBeenCalledTimes(11);
});
it('leaves temporary failures for the next scheduled invocation instead of looping retries', async () => {
  let claims = 0;
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === 'claim_schedule_push' ? (claims++, Array(10).fill(job)) : true,
    error: null,
  }));
  expect(
    (await deliverSchedulePush({ rpc }, 'token', async () => 503)).retry,
  ).toBe(10);
  expect(claims).toBe(1);
});
