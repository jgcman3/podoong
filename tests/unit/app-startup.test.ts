import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { appleStartupImages, startupScreens } from '@/lib/app-startup.mjs';
it('every iPhone startup metadata entry points to a PNG with matching native dimensions', () => {
  const entries = appleStartupImages();
  expect(entries).toHaveLength(startupScreens.length * 2);
  expect(new Set(entries.map((entry) => entry.media)).size).toBe(
    entries.length,
  );
  for (const entry of entries) {
    const match = entry.url.match(
      /\/(\d+)x(\d+)@(\d+)-(portrait|landscape)\.png$/,
    )!;
    expect(match).not.toBeNull();
    const [, w, h, dpr, orientation] = match,
      bytes = readFileSync('public' + entry.url);
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(
      Number(orientation === 'portrait' ? w : h) * Number(dpr),
    );
    expect(bytes.readUInt32BE(20)).toBe(
      Number(orientation === 'portrait' ? h : w) * Number(dpr),
    );
  }
});
