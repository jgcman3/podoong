import { test, expect } from 'vitest';
import {
  signupAgreementAccepted,
  signupAgreementVersion,
} from '../../src/features/legal/signup-model';

test('signup requires both current document versions and explicit selections', () => {
  const form = new FormData();
  form.set('termsVersion', signupAgreementVersion);
  form.set('collectionVersion', signupAgreementVersion);
  expect(signupAgreementAccepted(form)).toBe(false);
  form.set('terms', 'on');
  expect(signupAgreementAccepted(form)).toBe(false);
  form.set('collection', 'on');
  expect(signupAgreementAccepted(form)).toBe(true);
  form.set('termsVersion', 'old-version');
  expect(signupAgreementAccepted(form)).toBe(false);
  form.set('termsVersion', signupAgreementVersion);
  form.set('collection', 'true');
  expect(signupAgreementAccepted(form)).toBe(false);
});
