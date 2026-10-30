import { describe, expect, it } from 'vitest';
import { invitationToken } from '../../src/features/family/join-model';

describe('family invitation input', () => {
  const token = 'ab'.repeat(32);
  it('accepts a copied invitation link or the exact token', () => {
    expect(
      invitationToken(` https://dev.podoong.com/ko/invite/${token} `),
    ).toBe(token);
    expect(
      invitationToken(`http://localhost:3187/en/invite/${token}/?from=family`),
    ).toBe(token);
    expect(invitationToken(token)).toBe(token);
  });
  it('rejects external navigation, other routes and partial tokens', () => {
    for (const input of [
      null,
      '',
      token.slice(1),
      `javascript:/ko/invite/${token}`,
      `https://podoong.com/ko/share/diary/${token}`,
      `https://podoong.com/ko/invite/${token}/other`,
    ]) {
      expect(invitationToken(input)).toBeNull();
    }
  });
});
