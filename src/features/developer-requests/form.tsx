'use client';
import { useActionState, useState } from 'react';
import type { Locale } from '@/lib/domain';
import { createRecordId } from '@/lib/record-id';
import { submitDeveloperRequest } from './actions';
export function DeveloperRequestForm({
  locale,
  initialId,
}: {
  locale: Locale;
  initialId: string;
}) {
  const ko = locale === 'ko';
  const [id, setId] = useState(initialId),
    [body, setBody] = useState('');
  const [state, action, pending] = useActionState(
    async (
      previous: import('./actions').DeveloperRequestState,
      form: FormData,
    ) => {
      const result = await submitDeveloperRequest(previous, form);
      if (result.saved) {
        setBody('');
        setId(createRecordId());
      }
      return result;
    },
    { saved: false },
  );
  return (
    <form action={action} className="form-stack developer-request-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <label>
        {ko ? '요청 종류' : 'Request type'}
        <select name="category" defaultValue="feature">
          <option value="feature">
            {ko ? '기능 제안' : 'Feature suggestion'}
          </option>
          <option value="bug">{ko ? '오류 제보' : 'Report a bug'}</option>
          <option value="other">{ko ? '기타 의견' : 'Other feedback'}</option>
        </select>
      </label>
      <label>
        {ko ? '요청 내용' : 'Your request'}
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          maxLength={2000}
          rows={4}
          placeholder={
            ko
              ? '필요한 기능이나 불편했던 점을 알려주세요.'
              : 'Tell us what you need or what went wrong.'
          }
        />
      </label>
      <p className="small muted">
        {ko
          ? '아이의 개인정보·건강정보는 적지 마세요.'
          : 'Please do not include children’s personal or health information.'}
      </p>
      {state.error && (
        <p role="alert">
          {ko
            ? '접수하지 못했어요. 다시 시도해 주세요.'
            : 'Could not submit. Please try again.'}
        </p>
      )}
      <button className="button primary" disabled={pending || !body.trim()}>
        {pending
          ? ko
            ? '접수 중…'
            : 'Submitting…'
          : state.saved && !body
            ? ko
              ? '접수 완료'
              : 'Received'
            : ko
              ? '요청 보내기'
              : 'Send request'}
      </button>
    </form>
  );
}
