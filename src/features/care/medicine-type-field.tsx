'use client';
import { useState } from 'react';
import type { Locale } from '@/lib/domain';
import { QuickFieldTitle } from './quick-field-title';

export function MedicineTypeField({
  locale,
  name = 'medicine',
  defaultValue = '',
  value,
  onChange,
}: {
  locale: Locale;
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const current = value ?? selected;
  const options =
    locale === 'ko'
      ? ['해열제', '감기약', '항생제', '알레르기약', '소화기약', '기타']
      : [
          'Fever medicine',
          'Cold medicine',
          'Antibiotic',
          'Allergy medicine',
          'Digestive medicine',
          'Other',
        ];
  const previous = defaultValue || value;
  if (previous && !options.includes(previous)) options.push(previous);
  return (
    <fieldset className="quick-vaccine-choices">
      <legend>
        <QuickFieldTitle>
          {locale === 'ko' ? '약 종류' : 'Medicine type'}
        </QuickFieldTitle>
      </legend>
      <input type="hidden" name={name} value={current} />
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={current === option}
            onClick={() => {
              setSelected(option);
              onChange?.(option);
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
