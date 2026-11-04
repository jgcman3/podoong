'use client';
import type { Locale } from '@/lib/domain';
import { QuickFieldTitle } from './quick-field-title';
export function QuickTimeField({
  label,
  value,
  locale,
  onChange,
  onDateChange,
}: {
  label: string;
  value: string;
  locale: Locale;
  onChange: (value: string) => void;
  onDateChange?: (date: string) => void;
}) {
  const date = value ? new Date(value) : null;
  const clock =
    date && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
        }).format(date)
      : '--:--';
  return (
    <div
      className={`quick-time-edit${onDateChange ? ' quick-date-time-row' : ''}`}
    >
      {onDateChange && (
        <label>
          <QuickFieldTitle>
            {locale === 'ko' ? '기록 날짜' : 'Record date'}
          </QuickFieldTitle>
          <span className="quick-time-control">
            <span aria-hidden="true">
              {date && Number.isFinite(date.getTime())
                ? new Intl.DateTimeFormat(locale, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  }).format(date)
                : '--'}
            </span>
            <input
              type="date"
              aria-label={locale === 'ko' ? '기록 날짜' : 'Record date'}
              value={value.slice(0, 10)}
              onChange={(e) => onDateChange(e.target.value)}
              required
            />
          </span>
        </label>
      )}
      <label>
        <QuickFieldTitle>{label}</QuickFieldTitle>
        <span className="quick-time-control">
          <span aria-hidden="true">{clock}</span>
          <input
            aria-label={label}
            type="time"
            step="60"
            value={value.slice(11, 16)}
            onChange={(e) => onChange(e.target.value)}
            required
          />
        </span>
      </label>
    </div>
  );
}
