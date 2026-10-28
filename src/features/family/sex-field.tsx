import type { Locale } from '@/lib/domain';
export function ChildSexField({
  locale,
  value = '',
}: {
  locale: Locale;
  value?: string;
}) {
  const ko = locale === 'ko';
  return (
    <label>
      {ko ? '성별' : 'Sex'}
      <select
        name="sex"
        aria-label={ko ? '성별' : 'Sex'}
        required
        defaultValue={value}
      >
        <option value="" disabled>
          {ko ? '선택해 주세요' : 'Select sex'}
        </option>
        <option value="female">{ko ? '여아' : 'Girl'}</option>
        <option value="male">{ko ? '남아' : 'Boy'}</option>
      </select>
    </label>
  );
}
