'use client';
import type { Locale } from '@/lib/domain';
import { names, vaccines } from './copy';
import { QuickFieldTitle } from '@/features/care/quick-field-title';
const shortNames = {
  ko: [
    'BCG',
    'B형간염',
    'DTaP',
    '폴리오',
    'Hib',
    '폐렴구균',
    '로타',
    'MMR',
    '수두',
    'A형간염',
    '일본뇌염',
    'HPV',
    '독감',
    '기타',
  ],
  en: [
    'BCG',
    'Hep B',
    'DTaP',
    'Polio',
    'Hib',
    'PCV',
    'Rotavirus',
    'MMR',
    'Varicella',
    'Hep A',
    'JE',
    'HPV',
    'Flu',
    'Other',
  ],
};
export function VaccinePicker({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="quick-vaccine-choices">
      <legend>
        <QuickFieldTitle>
          {locale === 'ko' ? '백신' : 'Vaccine'}
        </QuickFieldTitle>
      </legend>
      <div>
        {vaccines.map((v, i) => (
          <button
            type="button"
            key={v}
            aria-label={names[locale][i]}
            aria-pressed={value === v}
            title={names[locale][i]}
            onClick={() => onChange(v)}
          >
            {shortNames[locale][i]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
