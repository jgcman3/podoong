// This preference is a device hint, never an authentication or account identity.
export const LAST_SOCIAL_COOKIE = 'podoong-last-social';
export function socialProvider(value: string | null | undefined) {
  return value === 'kakao' || value === 'naver' || value === 'google'
    ? value
    : null;
}
