// Normalize on the device so originals never hit the server request-size limit.
import { POST_PHOTO_BYTES } from './post-model';
const MAX_EDGE = 2048;
async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function decodePhoto(file: File) {
  try {
    return await loadImage(file);
  } catch {
    const header = new TextDecoder('latin1').decode(
      await file.slice(0, 80).arrayBuffer(),
    );
    if (
      !/heic|heif/i.test(file.type + file.name) &&
      !/ftyp.*(?:heic|heix|hevc|hevx|mif1|msf1)/.test(header)
    )
      throw Error('Unreadable photo');
    // Only HEIC browsers cannot display need the extra decoder download.
    const { heicTo } = await import('heic-to/csp');
    const jpeg = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.95,
    });
    return loadImage(jpeg);
  }
}
function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(Error('Photo conversion failed')),
      'image/jpeg',
      quality,
    ),
  );
}
export async function prepareCommunityPhoto(file: File): Promise<File> {
  const image = await decodePhoto(file);
  const scale = Math.min(
    1,
    MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement('canvas');
  let width = Math.max(1, Math.round(image.naturalWidth * scale));
  let height = Math.max(1, Math.round(image.naturalHeight * scale));
  try {
    for (;;) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw Error('Photo conversion unavailable');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      for (const quality of [0.86, 0.74, 0.62, 0.5]) {
        const blob = await encode(canvas, quality);
        if (blob.size <= POST_PHOTO_BYTES)
          return new File([blob], 'photo.jpg', {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          });
      }
      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }
  } finally {
    canvas.width = canvas.height = 0;
  }
}
