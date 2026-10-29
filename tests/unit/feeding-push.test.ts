import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it, expect, vi } from 'vitest';
import {
  deliverFeedingPush,
  feedingPushPayload,
  validPushEndpoint,
} from '../../supabase/functions/_shared/feeding-push.mjs';
const job = {
  id: 'job',
  lease_token: 'lease',
  endpoint: 'https://fcm.googleapis.com/fcm/send/fixture',
  p256dh: 'key',
  auth_key: 'auth',
  locale: 'ko',
  child_id: 'child',
};
describe('feeding push delivery', () => {
  it('keeps private baby names and care amounts out of the lock screen payload', () => {
    expect(feedingPushPayload(job)).toEqual({
      title: '다음 먹이기 시간이에요',
      body: '아기의 식사 시간을 확인해 주세요.',
      tag: 'feeding:child',
      url: '/ko/today?child=child',
    });
    expect(feedingPushPayload({ ...job, locale: 'en' }).url).toBe(
      '/en/today?child=child',
    );
  });
  it.each([
    'http://fcm.googleapis.com/fcm/send/test',
    'https://127.0.0.1/admin',
    'https://fcm.googleapis.com.evil.test/',
    'https://user@fcm.googleapis.com/',
    'https://fcm.googleapis.com:4433/',
  ])('rejects untrusted push endpoint %s', (url) => {
    expect(validPushEndpoint(url)).toBe(false);
  });
  it.each([
    'https://fcm.googleapis.com/fcm/send/a',
    'https://updates.push.services.mozilla.com/wpush/v2/a',
    'https://web.push.apple.com/a',
    'https://wns2-db5p.notify.windows.com/w/a',
  ])('allows browser push endpoint %s', (url) => {
    expect(validPushEndpoint(url)).toBe(true);
  });
  it.each([
    [201, 'sent'],
    [410, 'gone'],
    [404, 'gone'],
    [503, 'retry'],
  ])(
    'handles push service status %s without logging payloads',
    async (status, result) => {
      const rpc = vi.fn(async (name: string) => ({
        data: name === 'claim_feeding_push' ? [job] : true,
        error: null,
      }));
      const send = vi.fn(async () => status);
      await deliverFeedingPush({ rpc }, 'token', send);
      expect(send).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenLastCalledWith('finish_feeding_push', {
        p_id: 'job',
        p_lease: 'lease',
        p_result: result,
      });
    },
  );
  it('does not send a reminder invalidated by a newer meal or revoked access', async () => {
    const rpc = vi.fn(async (name: string) => ({
        data: name === 'claim_feeding_push' ? [job] : false,
        error: null,
      })),
      send = vi.fn();
    await deliverFeedingPush({ rpc }, 'token', send);
    expect(send).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenLastCalledWith('finish_feeding_push', {
      p_id: 'job',
      p_lease: 'lease',
      p_result: 'cancelled',
    });
  });
  it('never claims jobs with an invalid worker credential', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: '42501' } })),
      send = vi.fn();
    await expect(deliverFeedingPush({ rpc }, 'bad', send)).rejects.toThrow(
      'unauthorized',
    );
    expect(send).not.toHaveBeenCalled();
  });
});

describe('feeding notification service worker', () => {
  it('shows a visible alert without an open app and keeps navigation on the app origin', async () => {
    const handlers = new Map<string, (event: unknown) => void>(),
      showNotification = vi.fn(async () => {});
    const worker = {
      location: { origin: 'https://podung.example' },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
      registration: { showNotification },
    };
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: worker,
      URL,
    });
    let pending: Promise<unknown> | undefined;
    handlers.get('push')!({
      data: {
        json: () => ({
          title: 'Reminder',
          body: 'Next feeding',
          url: 'https://evil.test/private',
        }),
      },
      waitUntil: (task: Promise<unknown>) => {
        pending = task;
      },
    });
    await pending;
    expect(showNotification).toHaveBeenCalledWith(
      'Reminder',
      expect.objectContaining({
        body: 'Next feeding',
        data: { url: 'https://podung.example/ko/today' },
      }),
    );
  });
  it('focuses the existing app instead of adding another window on notification click', async () => {
    const handlers = new Map<string, (event: unknown) => void>(),
      navigate = vi.fn(async () => {}),
      focus = vi.fn(async () => {}),
      openWindow = vi.fn();
    const worker = {
      location: { origin: 'https://podung.example' },
      addEventListener: (name: string, handler: (event: unknown) => void) =>
        handlers.set(name, handler),
      clients: {
        matchAll: async () => [
          { url: 'https://podung.example/ko/calendar', navigate, focus },
        ],
        openWindow,
      },
    };
    runInNewContext(readFileSync('public/sw.js', 'utf8'), {
      self: worker,
      URL,
    });
    let pending: Promise<unknown> | undefined;
    handlers.get('notificationclick')!({
      notification: {
        close: vi.fn(),
        data: { url: 'https://podung.example/en/today?child=fixture' },
      },
      waitUntil: (task: Promise<unknown>) => {
        pending = task;
      },
    });
    await pending;
    expect(navigate).toHaveBeenCalledWith(
      'https://podung.example/en/today?child=fixture',
    );
    expect(focus).toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });
});
