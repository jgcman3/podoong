import type { Locale } from '@/lib/domain';

export const momentDesigns = [
  {
    id: 'cinema',
    ko: '시네마',
    en: 'Cinema',
    background: '#24303d',
    paper: '#24303d',
    photo: '#82736f',
    accent: '#e5cfb4',
  },
  {
    id: 'film',
    ko: '필름 앨범',
    en: 'Film album',
    background: '#eee0ca',
    paper: '#ffffff',
    photo: '#d9bca4',
    accent: '#8b5e47',
  },
  {
    id: 'postcard',
    ko: '오후의 엽서',
    en: 'Afternoon postcard',
    background: '#edf0e8',
    paper: '#fffdf7',
    photo: '#b4c2b0',
    accent: '#526650',
  },
] as const;
export type MomentDesign = (typeof momentDesigns)[number]['id'];

// Cover the frame completely; the two positions choose which part remains visible.
export function momentPhotoPlacement(
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
  positionX = 50,
  positionY = 35,
) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const w = imageWidth * scale,
    h = imageHeight * scale;
  return {
    width: w,
    height: h,
    x: ((width - w) * Math.max(0, Math.min(100, positionX))) / 100,
    y: ((height - h) * Math.max(0, Math.min(100, positionY))) / 100,
  };
}

export async function readMomentPhoto(photo: string, signal: AbortSignal) {
  const url = new URL(photo, location.origin);
  if (url.origin !== location.origin) throw Error('Unsupported photo');
  url.searchParams.set('size', '1600');
  const response = await fetch(url, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw Error('Photo unavailable');
  const blob = await response.blob();
  signal.throwIfAborted();
  return blob;
}

export function shortMoment(text: string, max = 160) {
  return [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
  ]
    .slice(0, max)
    .map((part) => part.segment)
    .join('');
}

export function momentLines(
  text: string,
  width: number,
  measure: (text: string) => number,
  limit: number,
) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const { segment } of new Intl.Segmenter(undefined, {
      granularity: 'word',
    }).segment(paragraph)) {
      if (line && measure(line + segment) > width) {
        lines.push(line.trimEnd());
        line = '';
      }
      for (const { segment: character } of new Intl.Segmenter(undefined, {
        granularity: 'grapheme',
      }).segment(segment)) {
        if (line && measure(line + character) > width) {
          lines.push(line.trimEnd());
          line = '';
        }
        if (line || character.trim()) line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  const truncated = lines.length > limit;
  const selected = lines.slice(0, limit);
  if (truncated && selected.length) {
    let last = selected[selected.length - 1];
    while (last && measure(last + '…') > width) {
      const segments = [
        ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
          last,
        ),
      ];
      last = segments
        .slice(0, -1)
        .map((part) => part.segment)
        .join('');
    }
    selected[selected.length - 1] = last + '…';
  }
  return { lines: selected, truncated };
}

export async function createMomentImage({
  name,
  age,
  date,
  text,
  photo,
  locale,
  signal,
  design = 'cinema',
  positionX = 50,
  positionY = 35,
}: {
  name: string;
  age: number | null;
  date: string;
  text: string;
  photo?: Blob;
  design?: MomentDesign;
  locale: Locale;
  signal: AbortSignal;
  positionX?: number;
  positionY?: number;
}) {
  await document.fonts.ready;
  signal.throwIfAborted();
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('Canvas unavailable');
  const image = photo ? await createImageBitmap(photo) : undefined;
  const ko = locale === 'ko';
  const sans =
    '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const serif = 'Georgia, "AppleMyungjo", "Batang", serif';
  let truncated = false;
  const font = (size: number, weight = 400, family = sans) => {
    ctx.font = `${weight} ${size}px ${family}`;
  };
  const round = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string,
  ) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };
  const line = (
    x: number,
    y: number,
    w: number,
    color: string,
    thickness = 1,
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  };
  const photoFrame = (
    x: number,
    y: number,
    w: number,
    h: number,
    radius = 0,
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();
    if (image) {
      const fit = momentPhotoPlacement(
        image.width,
        image.height,
        w,
        h,
        positionX,
        positionY,
      );
      ctx.drawImage(image, x + fit.x, y + fit.y, fit.width, fit.height);
    } else {
      const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
      gradient.addColorStop(0, '#ebceb8');
      gradient.addColorStop(0.5, '#dbc8dc');
      gradient.addColorStop(1, '#a8bdc2');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#ffffff88';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        x + w * 0.62,
        y + h * 0.35,
        Math.min(w, h) * 0.25,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.fillStyle = '#ffffffbb';
      font(Math.min(w, h) * 0.16, 400, serif);
      ctx.textAlign = 'center';
      ctx.fillText('♡', x + w * 0.5, y + h * 0.58);
    }
    ctx.restore();
  };
  const title = name.trim() || (ko ? '오늘의 작은 순간' : 'Our little moment');
  const ageText = age === null ? '' : `D+${age}`;
  const dateText = date.replaceAll('-', '.');
  const heading = (
    value: string,
    x: number,
    y: number,
    width: number,
    size: number,
    color: string,
    align: CanvasTextAlign = 'left',
    family = sans,
  ) => {
    font(size, 700, family);
    ctx.textAlign = align;
    ctx.fillStyle = color;
    const wrapped = momentLines(
      value,
      width,
      (t) => ctx.measureText(t).width,
      2,
    );
    truncated ||= wrapped.truncated;
    wrapped.lines.forEach((t, i) => ctx.fillText(t, x, y + i * size * 1.15));
    return wrapped.lines.length;
  };
  const caption = (
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    align: CanvasTextAlign = 'left',
    maxSize = 34,
    family = sans,
  ) => {
    let body = { lines: [] as string[], truncated: false },
      size = maxSize;
    for (const candidate of [maxSize, maxSize - 3, maxSize - 6, 24]) {
      size = Math.max(24, candidate);
      font(size, 400, family);
      body = momentLines(
        text.trim(),
        width,
        (t) => ctx.measureText(t).width,
        Math.max(1, Math.floor(height / (size * 1.5))),
      );
      if (!body.truncated) break;
    }
    truncated ||= body.truncated;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    body.lines.forEach((t, i) => ctx.fillText(t, x, y + i * size * 1.5));
  };
  const footer = (color: string) => {
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    font(18);
    ctx.fillText(
      ko ? '포둥에서 간직한 하루 podoong.com' : 'A day to remember podoong.com',
      540,
      1303,
    );
  };
  try {
    signal.throwIfAborted();
    if (design === 'cinema') {
      photoFrame(0, 0, 1080, 1350);
      const gradient = ctx.createLinearGradient(0, 0, 0, 1350);
      gradient.addColorStop(0, '#14202a99');
      gradient.addColorStop(0.22, '#14202a00');
      gradient.addColorStop(0.4, '#14202a00');
      gradient.addColorStop(0.64, '#17222e66');
      gradient.addColorStop(1, '#101b29f5');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1350);
      ctx.strokeStyle = '#ffffff55';
      ctx.lineWidth = 1;
      ctx.strokeRect(35, 35, 1010, 1280);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffffdd';
      font(24, 500);
      ctx.fillText(dateText, 80, 100);
      line(80, 125, 68, '#f1d6bb', 3);
      if (ageText) {
        font(25, 600);
        const w = ctx.measureText(ageText).width + 40;
        round(1000 - w, 67, w, 48, 24, '#ffffff26');
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(ageText, 1000 - w / 2, 100);
      }
      font(32);
      const body = momentLines(
        text.trim(),
        900,
        (t) => ctx.measureText(t).width,
        6,
      );
      const bodyY = 1164 - Math.max(0, body.lines.length - 1) * 46;
      font(76, 700);
      const titleCount = momentLines(
        title,
        920,
        (value) => ctx.measureText(value).width,
        2,
      ).lines.length;
      const titleY = bodyY - 84 - (titleCount - 1) * 87;
      ctx.shadowColor = '#101b2955';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      heading(title, 78, titleY, 920, 76, '#fff');
      caption(80, bodyY, 900, 1220 - bodyY, '#fff9f0', 'left', 32);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      footer('#ffffffa6');
    } else if (design === 'postcard') {
      ctx.fillStyle = '#edf0e8';
      ctx.fillRect(0, 0, 1080, 1350);
      round(44, 44, 992, 1215, 5, '#fffdf7');
      photoFrame(66, 66, 948, 775, 2);
      ctx.fillStyle = '#526650';
      font(23, 500);
      ctx.textAlign = 'left';
      ctx.fillText(dateText, 94, 904);
      ctx.textAlign = 'right';
      ctx.fillText(ageText, 986, 904);
      line(94, 932, 892, '#bfcbb8');
      const count = heading(title, 94, 1006, 892, 56, '#364c3b', 'left', serif);
      caption(
        96,
        1070 + (count - 1) * 64,
        888,
        150 - (count - 1) * 64,
        '#627064',
        'left',
        30,
        serif,
      );
      footer('#72806e');
    } else {
      ctx.fillStyle = '#eee0ca';
      ctx.fillRect(0, 0, 1080, 1350);
      for (let y = 0; y < 1350; y += 8) line(0, y, 1080, '#8a705104');
      ctx.save();
      ctx.translate(540, 478);
      ctx.rotate(-0.055);
      ctx.translate(-540, -478);
      ctx.shadowColor = '#57432e30';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 15;
      round(90, 100, 900, 785, 3, '#fffef9');
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      photoFrame(122, 132, 836, 620, 1);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#876d59';
      font(27, 400, serif);
      ctx.fillText(dateText, 540, 817);
      font(23, 600);
      ctx.fillText(ageText, 540, 856);
      ctx.restore();
      ctx.save();
      ctx.translate(540, 108);
      ctx.rotate(0.035);
      round(-130, -30, 260, 60, 1, '#d0ae7eaa');
      line(-120, -10, 240, '#fff3d326');
      line(-120, 7, 240, '#fff3d326');
      ctx.restore();
      const count = heading(title, 86, 993, 908, 57, '#654937', 'left', serif);
      caption(
        88,
        1066 + (count - 1) * 66,
        900,
        190 - (count - 1) * 66,
        '#735d4b',
        'left',
        32,
        serif,
      );
      footer('#9b8774');
    }
    signal.throwIfAborted();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(Error('Export unavailable')),
        'image/png',
      ),
    );
    signal.throwIfAborted();
    return {
      file: new File([blob], `moment-${date}.png`, { type: 'image/png' }),
      truncated,
    };
  } finally {
    image?.close();
  }
}
