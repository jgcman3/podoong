import sharp from 'sharp';
export const photoVariantPath = (path, size) =>
  `${path}.display-v1-${size}.webp`;
export async function renderPhotoVariant(bytes, size) {
  return sharp(bytes, { limitInputPixels: 60000000 })
    .rotate()
    .resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: size === 1600 ? 90 : 76 })
    .toBuffer();
}
export async function storePhotoVariants(db, id, path, bytes, upsert = false) {
  const bucket = db.storage.from('child-care-photos');
  for (const size of [480, 1600]) {
    const image = await renderPhotoVariant(bytes, size);
    const stored = await bucket.upload(photoVariantPath(path, size), image, {
      contentType: 'image/webp',
      upsert,
    });
    if (stored.error) throw new Error('Photo variant upload failed');
  }
  const ready = await db.rpc('complete_child_photo_variants', { p_photo: id });
  if (ready.error) throw new Error('Photo variants unavailable');
}
