export const signupAgreementVersion = 'signup-2026-11-03-v1';
export function signupAgreementAccepted(form: FormData) {
  return (
    form.get('terms') === 'on' &&
    form.get('collection') === 'on' &&
    form.get('health') === 'on' &&
    form.get('termsVersion') === signupAgreementVersion &&
    form.get('collectionVersion') === signupAgreementVersion
  );
}
