import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRecordId } from '@/lib/record-id';
afterEach(() => vi.unstubAllGlobals());
describe('browser record IDs', () => {
  it('uses native UUIDs when available', () => {
    const randomUUID = vi.fn(() => 'a native UUID');
    vi.stubGlobal('crypto', { randomUUID });
    expect(createRecordId()).toBe('a native UUID');
    expect(randomUUID).toHaveBeenCalledOnce();
  });
  it('creates UUID v4 using secure random bytes when HTTP hides randomUUID', () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(
      globalThis.crypto,
    );
    vi.stubGlobal('crypto', { getRandomValues });
    const ids = Array.from({ length: 100 }, () => createRecordId());
    expect(new Set(ids).size).toBe(100);
    for (const id of ids)
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
  });
});
