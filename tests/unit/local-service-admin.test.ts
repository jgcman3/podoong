import { expect, test } from 'vitest';
import {
  DEVELOPMENT_PROJECT_REF,
  kakaoSubject,
  validateLocalAdminTarget,
  validateAdminBinding,
} from '../../scripts/local-service-admin.mjs';

test('local admin command permits only the intended development database outside hosted environments', () => {
  const url = `https://${DEVELOPMENT_PROJECT_REF}.supabase.co`;
  expect(() =>
    validateLocalAdminTarget(url, DEVELOPMENT_PROJECT_REF, {}),
  ).not.toThrow();
  for (const env of [
    { NODE_ENV: 'production' },
    { CI: 'true' },
    { VERCEL: '1' },
  ])
    expect(() =>
      validateLocalAdminTarget(url, DEVELOPMENT_PROJECT_REF, env),
    ).toThrow();
  expect(() =>
    validateLocalAdminTarget(
      'https://atdyjsxfxlhwxmxgtnte.supabase.co',
      DEVELOPMENT_PROJECT_REF,
      {},
    ),
  ).toThrow();
  expect(() => validateLocalAdminTarget(url, 'another-project', {})).toThrow();
});
test('editable profile fields cannot select an administrator', () => {
  expect(
    kakaoSubject({
      user_metadata: { name: '사과', provider_id: 'wanted' },
      app_metadata: { provider: 'kakao' },
      identities: [],
    }),
  ).toBeNull();
  expect(
    kakaoSubject({
      identities: [
        { provider: 'custom:naver', identity_data: { sub: 'wanted' } },
      ],
    }),
  ).toBeNull();
  expect(
    kakaoSubject({
      identities: [
        { provider: 'kakao', identity_data: { sub: 'stable-kakao-id' } },
      ],
    }),
  ).toBe('stable-kakao-id');
});
test('saved bindings reject other databases and providers', () => {
  const binding = {
    version: 1,
    projectRef: DEVELOPMENT_PROJECT_REF,
    provider: 'kakao',
    subject: 'stable-id',
  };
  expect(validateAdminBinding(binding)).toEqual(binding);
  for (const changed of [
    { ...binding, projectRef: 'production' },
    { ...binding, provider: 'google' },
    { ...binding, subject: '' },
  ])
    expect(() => validateAdminBinding(changed)).toThrow();
});
