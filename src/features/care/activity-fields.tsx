'use client';
import { MedicineTypeField } from './medicine-type-field';
import { QuickFieldTitle } from './quick-field-title';
import { useState, type CSSProperties } from 'react';
import { Plus, Minus } from 'lucide-react';
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
  const [medicine, setMedicine] = useState(record?.medicine_name ?? '');
  const preserveDose = medicine === record?.medicine_name;
  return (
    <div className="activity-fields">
      {kind === 'temperature' && (
        <div className="quick-amount-picker">
          <div className="quick-amount-heading">
            <output aria-live="polite" aria-label={ko ? '체온' : 'Temperature'}>
              {Number(temperature).toFixed(1)}
              <small>°C</small>
            </output>
          </div>
          <div
            className="quick-ruler"
            style={
              {
                '--quick-level': `${((Number(temperature) - 30) / 15) * 100}%`,
              } as CSSProperties
            }
          >
            <div className="quick-ruler-ticks" aria-hidden="true">
              {[45, 42, 39, 36, 33, 30].map((value) => (
                <span key={value}>
                  <i />
                  {value}
                </span>
              ))}
            </div>
            <input
              name="temperature"
              type="range"
              aria-label={ko ? '체온 (°C)' : 'Temperature (°C)'}
              aria-valuetext={`${Number(temperature).toFixed(1)} °C`}
              min="30"
              max="45"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
            <div className="quick-ruler-cue" aria-hidden="true">
              <Plus size={14} />
              <Minus size={14} />
            </div>
          </div>
          <h4 className="quick-amount-label">
            <QuickFieldTitle>{ko ? '체온' : 'Temperature'}</QuickFieldTitle>
          </h4>
          <div className="quick-choices quick-temperature-presets">
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
        </div>
      )}
      {kind === 'medication' && (
        <>
          <MedicineTypeField
            locale={locale}
            value={medicine}
            defaultValue={record?.medicine_name ?? ''}
            onChange={setMedicine}
          />
          <input
            type="hidden"
            name="dose"
            value={preserveDose ? (record?.dose_amount ?? '') : ''}
          />
          <input
            type="hidden"
            name="doseUnit"
            value={preserveDose ? (record?.dose_unit ?? '') : ''}
          />
        </>
      )}
      {['bath', 'play', 'tummy'].includes(kind) && (
        <fieldset className="quick-duration quick-activity-duration">
          <legend>
            <QuickFieldTitle>
              {ko ? '소요 시간 (선택)' : 'Duration (optional)'}
            </QuickFieldTitle>
          </legend>
          <input type="hidden" name="activityDuration" value={duration} />
          <div className="quick-choices">
            {['3', '5', '10', '15', '20', '30', '60'].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={duration === n}
                onClick={() => setDuration(n)}
              >
                {`${n}${ko ? '분' : ' min'}`}
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
