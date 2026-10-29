'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { Locale } from '@/lib/domain';
export type ThemePreference = 'light' | 'dark' | 'system';
const ThemeContext = createContext<{
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
} | null>(null);
export function AppearanceProvider({
  children,
  initialPreference,
}: {
  children: ReactNode;
  initialPreference: ThemePreference;
}) {
  const [preference, setPreference] = useState(initialPreference);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved =
        preference === 'system'
          ? media.matches
            ? 'dark'
            : 'light'
          : preference;
      document.documentElement.dataset.theme = resolved;
      const suffix = `; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
      document.cookie = `podung-theme=${preference}${suffix}`;
      document.cookie = `podung-theme-resolved=${resolved}${suffix}`;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', resolved === 'dark' ? '#141a23' : '#f7f9fc');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function AppearanceSettings({ locale }: { locale: Locale }) {
  const theme = useContext(ThemeContext);
  if (!theme) throw Error('Appearance provider missing');
  const ko = locale === 'ko';
  return (
    <div
      className="appearance-options"
      role="group"
      aria-label={ko ? '화면 모드' : 'Appearance mode'}
    >
      {(
        [
          ['light', Sun, ko ? '밝게' : 'Light'],
          ['dark', Moon, ko ? '어둡게' : 'Dark'],
          ['system', Monitor, ko ? '기기 설정' : 'System'],
        ] as const
      ).map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme.preference === value}
          onClick={() => theme.setPreference(value)}
        >
          <Icon size={22} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
