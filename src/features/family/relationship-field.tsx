import { relationships } from './relationship';
export function RelationshipField({
  locale,
  value,
}: {
  locale: string;
  value?: string | null;
}) {
  return (
    <label>
      {locale === 'ko' ? '아이와의 관계' : 'Relationship to child'}
      <select name="relationship" required defaultValue={value ?? ''}>
        <option value="" disabled>
          {locale === 'ko'
            ? '관계 선택 (필수)'
            : 'Select relationship (required)'}
        </option>
        {Object.entries(relationships).map(([key, labels]) => (
          <option key={key} value={key}>
            {labels[locale === 'ko' ? 0 : 1]}
          </option>
        ))}
      </select>
    </label>
  );
}
