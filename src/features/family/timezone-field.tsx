'use client';
import { useState, useSyncExternalStore } from 'react';
import type { Locale } from '@/lib/domain';
import { isValidTimeZone } from '@/lib/timezones';

const subscribe = () => () => {};
function browserTimeZone() {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(detected) ? detected : 'Asia/Seoul';
}
const regionNames: Record<string, [string, string]> = {
  Africa: ['아프리카', 'Africa'],
  America: ['아메리카', 'Americas'],
  Antarctica: ['남극', 'Antarctica'],
  Arctic: ['북극', 'Arctic'],
  Asia: ['아시아', 'Asia'],
  Atlantic: ['대서양', 'Atlantic'],
  Australia: ['호주', 'Australia'],
  Europe: ['유럽', 'Europe'],
  Indian: ['인도양', 'Indian Ocean'],
  Pacific: ['태평양', 'Pacific'],
};

export function TimezoneField({
  locale,
  options,
  initialTimeZone,
}: {
  locale: Locale;
  options: string[];
  initialTimeZone?: string;
}) {
  const ko = locale === 'ko';
  const preset =
    initialTimeZone && isValidTimeZone(initialTimeZone)
      ? initialTimeZone
      : undefined;
  const detected = useSyncExternalStore(
    subscribe,
    browserTimeZone,
    () => preset ?? 'Asia/Seoul',
  );
  const [choice, setChoice] = useState<string>();
  const value = choice ?? preset ?? detected;
  const groups = new Map<string, string[]>();
  for (const zone of [...new Set([...options, value])].sort()) {
    if (zone === 'UTC') continue;
    const region = zone.split('/')[0];
    groups.set(region, [...(groups.get(region) ?? []), zone]);
  }
  return (
    <label>
      {ko ? '시간대' : 'Time zone'}
      <select
        name="timezone"
        aria-label={ko ? '시간대' : 'Time zone'}
        required
        value={value}
        onChange={(event) => setChoice(event.target.value)}
      >
        <option value="UTC">
          UTC · {ko ? '세계 표준시' : 'Coordinated Universal Time'}
        </option>
        {[...groups].map(([region, zones]) => (
          <optgroup
            key={region}
            label={regionNames[region]?.[ko ? 0 : 1] ?? region}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
