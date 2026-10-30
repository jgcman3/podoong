'use client';

import {
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react';
import { flushSync, useFormStatus } from 'react-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Locale } from '@/lib/domain';
import styles from './onboarding-form.module.css';

const mobileQuery = '(max-width: 639px)';
function subscribe(onChange: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;

function FormButtons({
  mobile,
  step,
  last,
  back,
  submitLabel,
  ko,
}: {
  mobile: boolean;
  step: number;
  last: boolean;
  back: () => void;
  submitLabel: string;
  ko: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <div
      className={`onboard-form-actions ${styles.actions}`}
      data-back={mobile && step > 0}
    >
      {mobile && step > 0 && (
        <button
          type="button"
          className={`button secondary ${styles.backButton}`}
          onClick={back}
          disabled={pending}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {ko ? '이전' : 'Back'}
        </button>
      )}
      <button
        type="submit"
        className={`button primary ${styles.nextButton}`}
        disabled={pending}
      >
        {pending
          ? ko
            ? '시작하는 중…'
            : 'Starting…'
          : mobile && !last
            ? ko
              ? '다음'
              : 'Next'
            : submitLabel}
        {mobile && !last && <ArrowRight size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function OnboardingForm({
  locale,
  next,
  action,
  fields,
  invitation,
  submitLabel,
  note,
}: {
  locale: Locale;
  next: string;
  action: (form: FormData) => Promise<void>;
  fields: { id: string; content: ReactNode }[];
  invitation: boolean;
  submitLabel: string;
  note: string;
}) {
  const ko = locale === 'ko';
  const mobile = useSyncExternalStore(
    subscribe,
    mobileSnapshot,
    serverSnapshot,
  );
  const [step, setStep] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const last = step === fields.length - 1;

  function moveTo(
    index: number,
    invalid?: HTMLInputElement | HTMLSelectElement,
  ) {
    // Reveal and focus within the tap/keyboard event so iOS retains the user
    // activation needed to focus an editable field and show its keyboard.
    flushSync(() => setStep(index));
    const field = form.current?.querySelector<HTMLElement>(
      `[data-field-index="${index}"]`,
    );
    const input =
      invalid ??
      field?.querySelector<HTMLInputElement | HTMLSelectElement>(
        'input, select',
      );
    input?.focus({ preventScroll: true });
    invalid?.reportValidity();
    requestAnimationFrame(() =>
      input?.scrollIntoView({ block: 'nearest', behavior: 'instant' }),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!mobile) return;
    const inputs = event.currentTarget.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('.onboard-step input, .onboard-step select');
    for (const input of inputs) {
      const index = Number(
        input.closest<HTMLElement>('[data-field-index]')?.dataset.fieldIndex,
      );
      if (!last && index !== step) continue;
      if (input instanceof HTMLInputElement && input.type === 'text') {
        input.setCustomValidity(
          input.value.trim()
            ? ''
            : ko
              ? '내용을 입력해 주세요.'
              : 'Enter a value.',
        );
      }
      if (!input.checkValidity()) {
        event.preventDefault();
        moveTo(index, input);
        return;
      }
    }
    if (!last) {
      event.preventDefault();
      moveTo(step + 1);
    }
  }

  return (
    <form
      ref={form}
      action={action}
      onSubmit={handleSubmit}
      noValidate={mobile}
      onInput={(event) => {
        if (event.target instanceof HTMLInputElement)
          event.target.setCustomValidity('');
      }}
      className={`form-stack onboard-information ${styles.form}`}
      data-mobile={mobile}
      data-last-step={last}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {mobile ? (
        <div className={`onboard-progress ${styles.progress}`}>
          <div>
            <span aria-live="polite">
              {step + 1} / {fields.length}
            </span>
            <span>{ko ? '필수 항목' : 'Required'}</span>
          </div>
          <progress
            value={step + 1}
            max={fields.length}
            aria-label={ko ? '가입 정보 입력 진행' : 'Signup progress'}
          />
        </div>
      ) : (
        <p className="small muted">
          {ko ? '모든 항목은 필수입니다.' : 'All fields are required.'}
        </p>
      )}
      <div className={`onboard-fields ${styles.fields}`}>
        {fields.map((field, index) => (
          <div
            key={field.id}
            className={`onboard-step ${styles.step}`}
            data-field-index={index}
            tabIndex={-1}
            hidden={mobile && index !== step}
          >
            {field.content}
          </div>
        ))}
      </div>
      <p className={`small muted onboard-development-note ${styles.note}`}>
        {note}
      </p>
      <FormButtons
        mobile={mobile}
        step={step}
        last={last}
        back={() => moveTo(step - 1)}
        submitLabel={submitLabel}
        ko={ko}
      />
      {!invitation && (
        <Link
          className={`text-link onboard-join-link ${styles.joinLink}`}
          href={`/${locale}/onboarding`}
        >
          {ko
            ? '가족이 이미 사용 중인가요?'
            : 'Is your family already using podoong?'}
        </Link>
      )}
    </form>
  );
}
