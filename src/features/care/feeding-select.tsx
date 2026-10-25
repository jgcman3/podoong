'use client';
import type { ChangeEventHandler } from 'react';
import { useTranslations, useLocale } from 'next-intl';
export const feedingChoices = {
  ml: {
    common: [30, 60, 90, 120, 150, 180, 210, 240],
    all: Array.from({ length: 60 }, (_, i) => (i + 1) * 10),
  },
  g: {
    common: [10, 20, 30, 50, 80, 100, 120, 150, 180, 200],
    all: Array.from({ length: 100 }, (_, i) => (i + 1) * 5),
  },
};
export function FeedingSelect({
  label,
  name,
  choices,
  unit,
  value,
  defaultValue,
  onChange,
  required = false,
}: {
  label: string;
  name: string;
  choices: keyof typeof feedingChoices;
  unit: string;
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLSelectElement>;
  required?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { common, all } = feedingChoices[choices];
  const current = value ?? defaultValue ?? '';
  const format = (v: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(v)} ${unit}`;
  const original = current !== '' && !all.includes(Number(current));
  return (
    <select
      aria-label={label}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      required={required}
    >
      <option value="">
        {required ? t('chooseValue') : t('amountUnknown')}
      </option>
      {original && (
        <option value={current}>
          {format(Number(current))} · {t('recordedValue')}
        </option>
      )}
      <optgroup label={t('frequentValues')}>
        {common.map((v) => (
          <option key={v} value={v}>
            {format(v)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t('otherValues')}>
        {all
          .filter((v) => !common.includes(v))
          .map((v) => (
            <option key={v} value={v}>
              {format(v)}
            </option>
          ))}
      </optgroup>
    </select>
  );
}
