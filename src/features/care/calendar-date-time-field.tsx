'use client';
import { useState } from 'react';
import type { Locale } from '@/lib/domain';
import { QuickFieldTitle } from './quick-field-title';

export function CalendarDateTimeField({
  label,
  name,
  type,
  defaultValue = '',
  required,
  max,
  locale,
}: {
  label: string;
  name: string;
  type: 'date' | 'time';
  defaultValue?: string;
  required?: boolean;
  max?: string;
  locale: Locale;
}) {
  const [value, setValue] = useState(defaultValue);
  const display = !value
    ? locale === 'ko'
      ? '선택'
      : 'Select'
    : type === 'date'
      ? new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${value}T00:00:00Z`))
      : new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        }).format(new Date(`2000-01-01T${value}:00Z`));
  return (
    <div className="quick-time-edit">
      <label>
        <QuickFieldTitle>{label}</QuickFieldTitle>
        <span className="quick-time-control">
          <span aria-hidden="true">{display}</span>
          <input
            aria-label={label}
            type={type}
            name={name}
            value={value}
            required={required}
            max={max}
            onChange={(event) => setValue(event.target.value)}
          />
        </span>
      </label>
    </div>
  );
}
