'use client';
import { useState } from 'react';
import type { Locale } from '@/lib/domain';
import type { Row } from '@/lib/db';
export function ActivityFields({
  kind,
  locale,
  record,
}: {
  kind: string;
  locale: Locale;
  record?: Row<'child_records'>;
}) {
  const ko = locale === 'ko';
  const [temperature, setTemperature] = useState(
    String(record?.temperature_c ?? '36.5'),
  );
  const [duration, setDuration] = useState(
    String(record?.duration_minutes ?? ''),
  );
  return (
    <div className="activity-fields">
      {kind === 'temperature' && (
        <>
          <label>
            {ko ? '체온 (°C)' : 'Temperature (°C)'}
            <input
              name="temperature"
              type="number"
              inputMode="decimal"
              min="30"
              max="45"
              step="0.1"
              required
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </label>
          <div className="quick-choices">
            {[36.5, 37, 37.5, 38, 38.5, 39].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={temperature === String(n)}
                onClick={() => setTemperature(String(n))}
              >
                {n}°C
              </button>
            ))}
          </div>
        </>
      )}
      {kind === 'medication' && (
        <>
          <label>
            {ko ? '약 이름' : 'Medicine'}
            <input
              name="medicine"
              maxLength={200}
              required
              defaultValue={record?.medicine_name ?? ''}
            />
          </label>
          <div className="form-row">
            <label>
              {ko ? '복용량' : 'Dose'}
              <input
                name="dose"
                type="number"
                inputMode="decimal"
                min="0.01"
                max="10000"
                step="any"
                required
                defaultValue={record?.dose_amount ?? ''}
              />
            </label>
            <label>
              {ko ? '단위' : 'Unit'}
              <select
                aria-label={ko ? '단위' : 'Unit'}
                name="doseUnit"
                defaultValue={record?.dose_unit ?? 'ml'}
              >
                {['ml', 'mg', 'g', 'tablet', 'drop', 'packet'].map((u, i) => (
                  <option key={u} value={u}>
                    {ko ? ['ml', 'mg', 'g', '정', '방울', '포'][i] : u}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
      {['bath', 'play', 'tummy'].includes(kind) && (
        <fieldset className="quick-duration">
          <legend>{ko ? '소요 시간 (선택)' : 'Duration (optional)'}</legend>
          <input type="hidden" name="activityDuration" value={duration} />
          <div className="quick-choices">
            {['', '3', '5', '10', '15', '20', '30', '60'].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={duration === n}
                onClick={() => setDuration(n)}
              >
                {n ? `${n}${ko ? '분' : ' min'}` : ko ? '기록 안 함' : 'Skip'}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {kind === 'hospital' && (
        <label>
          {ko ? '병원·방문 이유 (선택)' : 'Clinic / reason (optional)'}
          <input
            name="title"
            maxLength={200}
            defaultValue={record?.title ?? ''}
          />
        </label>
      )}
    </div>
  );
}
