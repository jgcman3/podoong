export const signupAgreementVersion = 'signup-2026-10-30-draft.1';
export function signupAgreementAccepted(form: FormData) {
  return (
    form.get('terms') === 'on' &&
    form.get('collection') === 'on' &&
    form.get('termsVersion') === signupAgreementVersion &&
    form.get('collectionVersion') === signupAgreementVersion
  );
}
