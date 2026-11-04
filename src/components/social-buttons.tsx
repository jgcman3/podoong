import { cookies } from 'next/headers';
import {
  LAST_SOCIAL_COOKIE,
  socialProvider,
} from '@/features/auth/last-social';
import { ConfirmButton } from './confirm-button';
import { getTranslations } from 'next-intl/server';
import { socialLogin } from '@/features/auth/actions';
import { configured } from '@/lib/supabase/server';
import type { Locale } from '@/lib/domain';
export async function SocialButtons({
  locale,
  next,
  link = false,
}: {
  locale: Locale;
  next?: string;
  link?: boolean;
}) {
  const t = await getTranslations();
  const lastSocial = link
    ? null
    : socialProvider((await cookies()).get(LAST_SOCIAL_COOKIE)?.value);
  const allowed = (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? '').split(',');
  return (
    <div className="social-buttons">
      {(['kakao', 'naver', 'google'] as const).map((provider) => (
        <form action={socialLogin} key={provider}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="next" value={next ?? `/${locale}/today`} />
          <input type="hidden" name="link" value={String(link)} />
          {link ? (
            <ConfirmButton
              className={`social ${provider}`}
              label={`${t('link')} · ${provider}`}
              message={t('linkConfirm')}
              disabled={!configured() || !allowed.includes(provider)}
            />
          ) : (
            <button
              className={`social ${provider}`}
              disabled={!configured() || !allowed.includes(provider)}
            >
              <span className="social-symbol" aria-hidden="true">
                {provider === 'kakao' ? '●' : provider === 'naver' ? 'N' : 'G'}
              </span>
              <span>{t(provider)}</span>
              {lastSocial === provider && (
                <span className="social-last-used">
                  {locale === 'ko' ? '최근 로그인' : 'Last used'}
                </span>
              )}
            </button>
          )}
        </form>
      ))}
    </div>
  );
}
