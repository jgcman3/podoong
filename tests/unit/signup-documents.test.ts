import { expect, test, vi } from 'vitest';
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => {
    throw Error('Database unavailable');
  }),
}));
import { readSignupDocument } from '@/features/legal/documents';
import { signupAgreementVersion } from '@/features/legal/signup-model';
import notices from '@/features/legal/signup-notices.json';
import { readFileSync } from 'node:fs';

test('signup terms and collection are readable without a database connection', async () => {
  const terms = await readSignupDocument('terms', signupAgreementVersion);
  const collection = await readSignupDocument(
    'signup-privacy',
    signupAgreementVersion,
  );
  expect(terms?.body).toContain('정경철');
  expect(collection?.body).toContain('privacy@podoong.com');
  expect(terms?.version).toBe(signupAgreementVersion);
  expect(collection?.body).toContain('건강정보');
});
test('bundled signup copies match the immutable DB migration snapshots', () => {
  const sql = readFileSync(
    'supabase/migrations/202611030088_signup_privacy_notices.sql',
    'utf8',
  );
  expect(sql).toContain(`$podoong_notice$${notices.terms}$podoong_notice$`);
  expect(sql).toContain(
    `$podoong_notice$${notices.account_collection}$podoong_notice$`,
  );
});
test('unrecognized or malformed document references do not serve another policy', async () => {
  expect(
    await readSignupDocument('privacy', signupAgreementVersion),
  ).toBeNull();
  expect(await readSignupDocument('terms', '../../other')).toBeNull();
});
