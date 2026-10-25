import { getTranslations } from 'next-intl/server';
const keys: Record<string, string> = {
  invalid: 'errorInvalid',
  conflict: 'errorConflict',
  invite: 'errorInvite',
  auth: 'errorAuth',
  timer: 'errorTimer',
  sleepRunning: 'errorSleepRunning',
  sleepOverlap: 'errorSleepOverlap',
  provider: 'providerUnavailable',
  lastIdentity: 'lastIdentity',
  reauth: 'reauth',
};
export async function Flash({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  const t = await getTranslations();
  return error ? (
    <div className="flash error" role="alert">
      {t(keys[error] ?? 'errorGeneric')}
    </div>
  ) : notice ? (
    <div className="flash" role="status">
      {t('noticeSaved')}
    </div>
  ) : null;
}
