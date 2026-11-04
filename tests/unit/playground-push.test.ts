import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import {
  deliverPlaygroundPush,
  playgroundPushPayload,
} from '../../supabase/functions/_shared/playground-push.mjs';
const job = {
  id: 'job',
  lease_token: 'lease',
  child_id: 'child',
  locale: 'ko',
  wave_count: 2,
  heart_count: 3,
  comfort_count: 0,
  endpoint: 'https://fcm.googleapis.com/fcm/send/test',
  p256dh: 'key',
  auth_key: 'auth',
};
it('groups counts without exposing names or photos on the lock screen', () => {
  const payload = playgroundPushPayload(job);
  expect(payload.body).toContain('인사 2개 · 하트 3개');
  expect(
    playgroundPushPayload({
      ...job,
      wave_count: 0,
      heart_count: 0,
      comfort_count: 2,
    }).body,
  ).toBe('토닥토닥 2번 받았어요. 놀이터에서 확인해 보세요.');
  expect(
    playgroundPushPayload({
      ...job,
      locale: 'en',
      wave_count: 0,
      heart_count: 0,
      comfort_count: 1,
    }).body,
  ).toContain('1 comforting pat.');
  expect(payload.tag).toBe('playground:child');
  expect(payload.url).toBe('/ko/community/playground?child=child&inbox=1');
  expect(
    playgroundPushPayload({
      ...job,
      locale: 'en',
      wave_count: 1,
      heart_count: 0,
    }).body,
  ).toContain('1 wave.');
});
it('rechecks access immediately before sending and finishes invalidated batches without sending', async () => {
  const rpc = vi.fn(async (name: string) => ({
    data: name === 'claim_playground_push' ? [job] : false,
    error: null,
  }));
  const send = vi.fn();
  await deliverPlaygroundPush({ rpc }, 'token', send);
  expect(send).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenLastCalledWith('finish_playground_push', {
    p_id: 'job',
    p_lease: 'lease',
    p_result: 'cancelled',
  });
});
it('limits concurrent browser push requests and processes each claimed delivery once', async () => {
  const jobs = Array.from({ length: 12 }, (_, i) => ({
    ...job,
    id: String(i),
  }));
  let active = 0,
    peak = 0;
  const rpc = vi.fn(async (name: string) => ({
    data: name === 'claim_playground_push' ? jobs : true,
    error: null,
  }));
  const send = vi.fn(async () => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    return 201;
  });
  expect(await deliverPlaygroundPush({ rpc }, 'token', send)).toEqual({
    sent: 12,
    retry: 0,
    gone: 0,
    cancelled: 0,
  });
  expect(send).toHaveBeenCalledTimes(12);
  expect(peak).toBeLessThanOrEqual(5);
  expect(
    rpc.mock.calls.filter(([name]) => name === 'finish_playground_push'),
  ).toHaveLength(12);
});
it('opens the received reactions from a playground notification and blocks other paths', async () => {
  const handlers = new Map();
  const navigate = vi.fn(async () => {}),
    focus = vi.fn(async () => {}),
    showNotification = vi.fn(
      async (title: string, options: { data: { url: string } }) => ({
        title,
        options,
      }),
    );
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    URL,
    self: {
      location: { origin: 'https://podoong.example' },
      registration: { showNotification },
      addEventListener: (name: string, handler: unknown) =>
        handlers.set(name, handler),
      clients: {
        matchAll: async () => [
          { url: 'https://podoong.example/ko/today', navigate, focus },
        ],
        openWindow: vi.fn(),
      },
    },
  });
  let pending: Promise<unknown> | undefined;
  handlers.get('push')({
    data: { json: () => playgroundPushPayload(job) },
    waitUntil: (task: Promise<unknown>) => {
      pending = task;
    },
  });
  await pending;
  const url = showNotification.mock.calls[0][1].data.url;
  expect(url).toBe(
    'https://podoong.example/ko/community/playground?child=child&inbox=1',
  );
  handlers.get('notificationclick')({
    notification: { close: vi.fn(), data: { url } },
    waitUntil: (task: Promise<unknown>) => {
      pending = task;
    },
  });
  await pending;
  expect(navigate).toHaveBeenCalledWith(url);
  expect(focus).toHaveBeenCalled();
  navigate.mockClear();
  handlers.get('notificationclick')({
    notification: {
      close: vi.fn(),
      data: { url: 'https://podoong.example/api/private' },
    },
    waitUntil: (task: Promise<unknown>) => {
      pending = task;
    },
  });
  await pending;
  expect(navigate).not.toHaveBeenCalled();
});
it('records provider failure status without logging subscription keys or private content', async () => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const rpc = vi.fn(async (name: string) => ({
      data: name === 'claim_playground_push' ? [job] : true,
      error: null,
    }));
    await deliverPlaygroundPush(
      { rpc },
      'secret-worker-token',
      async () => 403,
    );
    expect(warning).toHaveBeenCalledWith('web_push_delivery_failed', {
      operation: 'claim_playground_push',
      stage: 'provider',
      status: 403,
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain(
      'secret-worker-token',
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain(job.endpoint);
  } finally {
    warning.mockRestore();
  }
});
it('returns safe diagnostics to the scheduled invocation reporter', async () => {
  const report = vi.fn();
  const rpc = vi.fn(async (name: string) => ({
    data: name === 'claim_playground_push' ? [job] : true,
    error: null,
  }));
  await deliverPlaygroundPush({ rpc }, 'secret', async () => 403, report);
  expect(report).toHaveBeenCalledWith({
    operation: 'claim_playground_push',
    stage: 'provider',
    status: 403,
  });
});
