'use client';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Locale } from '@/lib/domain';
import type { MealPlan } from './meal-plan';
import { saveMealPlan } from './meal-plan-actions';

export function MealPlanEditor({
  locale,
  childId,
  plan,
  timezone,
  available,
}: {
  locale: Locale;
  childId: string;
  plan: MealPlan | null;
  timezone: string;
  available: boolean;
}) {
  const ko = locale === 'ko';
  const [kind, setKind] = useState<'feeding' | 'solids'>('feeding');
  if (!available)
    return (
      <p className="small muted">
        {ko
          ? '먹이기 시간 설정을 준비 중입니다.'
          : 'Feeding schedule settings are preparing.'}
      </p>
    );
  return (
    <details className="meal-settings">
      <summary>{ko ? '다음 먹이기 시간 설정' : 'Set the next feeding'}</summary>
      <p className="small muted">
        {ko
          ? '종류를 선택해 시간을 저장하세요. 아이를 함께 돌보는 가족에게 공유됩니다.'
          : 'Choose a type and save its times. Shared with this child’s caregivers.'}
      </p>
      <label>
        {ko ? '먹이기 종류' : 'Feeding type'}
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as typeof kind)}
        >
          <option value="feeding">{ko ? '수유' : 'Milk feeding'}</option>
          <option value="solids">{ko ? '이유식' : 'Solids'}</option>
        </select>
      </label>
      <form
        key={`${kind}:${JSON.stringify(plan)}`}
        action={saveMealPlan}
        className="form-stack"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="childId" value={childId} />
        {kind === 'feeding' ? (
          <>
            <input type="hidden" name="feeding" value="on" />
            <label>
              {ko ? '수유 간격 (분)' : 'Feeding interval (minutes)'}
              <input
                name="interval"
                type="number"
                min="30"
                max="1440"
                defaultValue={plan ? (plan.feedingMinutes ?? '') : 180}
              />
            </label>
            <p className="small muted">
              {ko
                ? '마지막 수유 종료 시각에 이 간격을 더합니다. 사용하지 않으면 비워두세요.'
                : 'Adds this interval to the latest feed end. Leave empty if unused.'}
            </p>
          </>
        ) : (
          <>
            {plan?.feedingMinutes !== null &&
              plan?.feedingMinutes !== undefined && (
                <input type="hidden" name="feeding" value="on" />
              )}
            <input
              type="hidden"
              name="interval"
              value={plan?.feedingMinutes ?? 180}
            />
          </>
        )}
        {(['solids'] as const).map((type) =>
          type === kind ? (
            <fieldset key={type}>
              <legend>{ko ? '매일 이유식 시간' : 'Daily solids times'}</legend>
              <div className="meal-inputs">
                {[0, 1, 2].map((index) => (
                  <label key={index}>
                    {ko ? `${index + 1}번째 시간` : `Time ${index + 1}`}
                    <input
                      type="time"
                      name={type}
                      defaultValue={plan?.[type][index] ?? ''}
                    />
                  </label>
                ))}
              </div>
              <p className="small muted">
                {ko
                  ? '사용하지 않는 시간은 비워두세요.'
                  : 'Leave unused times empty.'}
              </p>
            </fieldset>
          ) : (
            (plan?.[type] ?? []).map((time, index) => (
              <input
                key={`${type}:${index}`}
                type="hidden"
                name={type}
                value={time}
              />
            ))
          ),
        )}
        <label>
          {ko ? '시간대' : 'Timezone'}
          <select name="timezone" defaultValue={timezone}>
            {[
              'Asia/Seoul',
              'UTC',
              'America/New_York',
              'Europe/London',
              'Asia/Tokyo',
            ].map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        <SaveButton ko={ko} />
      </form>
    </details>
  );
}
function SaveButton({ ko }: { ko: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="button secondary" disabled={pending}>
      {pending
        ? ko
          ? '저장 중…'
          : 'Saving…'
        : ko
          ? '시간 저장'
          : 'Save schedule'}
    </button>
  );
}
