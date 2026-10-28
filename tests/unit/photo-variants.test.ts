import { expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  renderPhotoVariant,
  storePhotoVariants,
} from '@/features/growth-community/photo-variants.mjs';
it('creates bounded display images and only marks complete after both uploads', async () => {
  const original = await sharp({
    create: { width: 1800, height: 2400, channels: 3, background: '#f4c8a8' },
  })
    .jpeg()
    .toBuffer();
  const upload = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const db = { storage: { from: () => ({ upload }) }, rpc };
  await storePhotoVariants(db, 'photo-id', 'original.jpg', original);
  expect(upload).toHaveBeenCalledTimes(2);
  for (const [i, max] of [480, 1600].entries()) {
    const meta = await sharp(upload.mock.calls[i][1]).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBe(max);
  }
  expect(rpc).toHaveBeenCalledExactlyOnceWith('complete_child_photo_variants', {
    p_photo: 'photo-id',
  });
  expect(rpc.mock.invocationCallOrder[0]).toBeGreaterThan(
    upload.mock.invocationCallOrder[1],
  );
});
it('never marks partially uploaded variants complete', async () => {
  const original = await sharp({
    create: { width: 10, height: 10, channels: 3, background: '#eee' },
  })
    .png()
    .toBuffer();
  const rpc = vi.fn();
  const upload = vi
    .fn()
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: { message: 'failed' } });
  await expect(
    storePhotoVariants(
      { storage: { from: () => ({ upload }) }, rpc },
      'id',
      'photo.png',
      original,
    ),
  ).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it('does not upscale small photos', async () => {
  const original = await sharp({
    create: { width: 50, height: 75, channels: 3, background: '#eee' },
  })
    .png()
    .toBuffer();
  const meta = await sharp(await renderPhotoVariant(original, 1600)).metadata();
  expect([meta.width, meta.height]).toEqual([50, 75]);
});
