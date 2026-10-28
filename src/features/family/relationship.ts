export const relationships = {
  mother: ['엄마', 'Mother'],
  father: ['아빠', 'Father'],
  grandmother: ['할머니', 'Grandmother'],
  grandfather: ['할아버지', 'Grandfather'],
  maternal_aunt: ['이모', 'Maternal aunt'],
  paternal_aunt: ['고모', 'Paternal aunt'],
  maternal_uncle: ['외삼촌', 'Maternal uncle'],
  paternal_uncle: ['삼촌', 'Paternal uncle'],
  maternal_aunt_husband: ['이모부', 'Maternal aunt’s husband'],
  paternal_aunt_husband: ['고모부', 'Paternal aunt’s husband'],
  uncle_wife: ['숙모·외숙모', 'Uncle’s wife'],
  relative: ['친척', 'Relative'],
  guardian: ['기타 보호자', 'Other guardian'],
} as const;
export type Relationship = keyof typeof relationships;
export function isRelationship(value: unknown): value is Relationship {
  return typeof value === 'string' && Object.hasOwn(relationships, value);
}
export function relationshipLabel(
  value: string | null | undefined,
  locale: string,
) {
  return isRelationship(value)
    ? relationships[value][locale === 'ko' ? 0 : 1]
    : locale === 'ko'
      ? '보호자'
      : 'Caregiver';
}
