export const signupAgreementVersion = 'signup-2026-11-03-draft.2';
export function signupAgreementAccepted(form: FormData) {
  return (
    form.get('terms') === 'on' &&
    form.get('collection') === 'on' &&
    form.get('termsVersion') === signupAgreementVersion &&
    form.get('collectionVersion') === signupAgreementVersion
  );
}
