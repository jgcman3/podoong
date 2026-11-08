// Color grading only: preserve geometry and alpha, and strengthen existing rosy tones.
export function applyRosyFilm(pixels: Uint8ClampedArray, strength: number) {
  const amount = Math.max(0, Math.min(100, strength)) / 100;
  if (!amount) return;
  const smooth = (low: number, high: number, value: number) => {
    const x = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return x * x * (3 - 2 * x);
  };
  const tone = (value: number) => {
    const v = Math.max(0, Math.min(255, value)),
      x = v / 255;
    return (
      v +
      amount *
        (0.07 * (v - 127) * Math.sin(Math.PI * x) +
          2.5 * (1 - x) ** 3 -
          2 * x ** 8)
    );
  };
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const light = luminance / 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    const saturation = (max - min) / Math.max(1, max);
    const rosy =
      smooth(0.68, 0.9, (r - g) / Math.max(1, r - b)) *
      smooth(22, 75, r - g) *
      (1 - smooth(0.65, 0.95, saturation));
    const vivid = 1 + amount * 0.09;
    const noise =
      (((((i / 4) * 1664525 + 1013904223) >>> 16) & 255) / 255 - 0.5) *
      amount *
      2;
    pixels[i] =
      tone(
        luminance +
          (r - luminance) * vivid +
          amount * (5 * (1 - light * 0.8) + rosy * 20),
      ) + noise;
    pixels[i + 1] =
      tone(luminance + (g - luminance) * vivid + amount * (1 - rosy * 18)) +
      noise;
    pixels[i + 2] =
      tone(
        luminance +
          (b - luminance) * vivid -
          amount * (6 * (1 - light * 0.5) + rosy * 3),
      ) + noise;
  }
}

export type MomentFilter = 'original' | 'rosy' | 'sunlight';

export function applySunlight(pixels: Uint8ClampedArray, strength: number) {
  const amount = Math.max(0, Math.min(100, strength)) / 100;
  if (!amount) return;
  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue;
    const r = pixels[i],
      g = pixels[i + 1],
      b = pixels[i + 2];
    const light = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
    const lift = amount * 25 * Math.sin(Math.PI * light);
    pixels[i] = r + lift + amount * 3 * (1 - light);
    pixels[i + 1] = g + lift + amount * 2;
    pixels[i + 2] = b + lift + amount * 4 * (1 - light);
  }
}

export async function filteredMomentPhoto(
  photo: Blob,
  strength: number,
  signal: AbortSignal,
  filter: Exclude<MomentFilter, 'original'>,
) {
  if (strength <= 0) return photo;
  signal.throwIfAborted();
  const image = await createImageBitmap(photo);
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw Error('Photo processing unavailable');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    signal.throwIfAborted();
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (filter === 'rosy') applyRosyFilm(pixels.data, strength);
    else applySunlight(pixels.data, strength);
    ctx.putImageData(pixels, 0, 0);
    signal.throwIfAborted();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(Error('Photo processing unavailable')),
        'image/png',
      ),
    );
    signal.throwIfAborted();
    return blob;
  } finally {
    image.close();
  }
}
