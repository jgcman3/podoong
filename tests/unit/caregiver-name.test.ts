import { expect, test } from 'vitest';
import { caregiverName } from '@/features/auth/caregiver-name';

test('keeps an edited profile name when the social nickname changes', () => {
  expect(caregiverName('지혜 아빠', { nickname: '새로운 소셜 별명' })).toBe(
    '지혜 아빠',
  );
});
test('prefills from social nickname then display name and falls back to manual input', () => {
  expect(
    caregiverName('', { nickname: '포둥맘', name: 'Social display name' }),
  ).toBe('포둥맘');
  expect(caregiverName('', { name: '표시 이름' })).toBe('표시 이름');
  expect(caregiverName('', { full_name: 'Google display name' })).toBe(
    'Google display name',
  );
  expect(
    caregiverName('', { email: 'private@example.test', phone: '01000000000' }),
  ).toBe('');
  expect(caregiverName('', { nickname: { name: 'invalid' }, name: 42 })).toBe(
    '',
  );
});
