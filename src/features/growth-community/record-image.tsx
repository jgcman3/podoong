'use client';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { careIcons } from '@/features/care/activity-config';
import type { DiaryRecordRow } from './record-image-model';

function fit(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  let value = text;
  while (value && ctx.measureText(`${value}…`).width > width)
    value = value.slice(0, -1);
  return `${value}…`;
}
export async function recordImage(
  rows: DiaryRecordRow[],
  day: string,
  age: number,
  feeding: { formula: number; solids: number },
  page: number,
  total: number,
  locale: 'ko' | 'en',
) {
  await document.fonts.ready;
  const holder = document.createElement('div');
  holder.style.cssText =
    'position:fixed;left:-10000px;top:0;pointer-events:none';
  holder.setAttribute('aria-hidden', 'true');
  document.body.append(holder);
  const root = createRoot(holder);
  let icons: { image: HTMLImageElement; ink: string; background: string }[];
  try {
    flushSync(() =>
      root.render(
        <>
          {rows.map((row, index) => {
            const Icon =
              careIcons[row.color as keyof typeof careIcons] ??
              careIcons.growth;
            return (
              <span key={index} className={`quick-color-${row.color}`}>
                <Icon size={24} />
              </span>
            );
          })}
        </>,
      ),
    );
    icons = await Promise.all(
      Array.from(holder.children).map(async (node) => {
        const style = getComputedStyle(node);
        const ink = style.getPropertyValue('--care-ink').trim() || '#64748b';
        const background =
          style.getPropertyValue('--care-bg').trim() || '#f7f9fc';
        const svg = node.querySelector('svg')!.cloneNode(true) as SVGElement;
        svg.setAttribute('color', ink);
        const image = new Image();
        const loaded = new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('Icon unavailable'));
        });
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
        await loaded;
        return { image, ink, background };
      }),
    );
  } finally {
    root.unmount();
    holder.remove();
  }
  const scale = 4.5,
    width = 400,
    height = 92 + rows.length * 50;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.scale(scale, scale);
  const style = getComputedStyle(document.body);
  const token = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  const family = style.fontFamily;
  const font = (size: number, bold = false) => {
    ctx.font = `${bold ? 700 : 400} ${size}px ${family}`;
  };
  const rounded = (
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
  ) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  };
  const muted = '#64748b',
    ink = '#293747';
  const cardInk = token('--ink', ink),
    cardMuted = token('--muted', muted);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  const date = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
  ctx.textAlign = 'left';
  font(11, true);
  ctx.fillStyle = ink;
  ctx.fillText(date, 28, 33);
  const dateWidth = ctx.measureText(date).width;
  font(10);
  ctx.fillStyle = muted;
  ctx.fillText(` · D+${age}`, 28 + dateWidth, 33);
  const number = new Intl.NumberFormat(locale);
  const amounts = [
    `${locale === 'ko' ? '총' : 'Total'} ${number.format(feeding.formula + feeding.solids)} ml`,
    ` (${number.format(feeding.formula)}`,
    ' + ',
    `${number.format(feeding.solids)})`,
  ];
  font(10, true);
  const fullWidth = amounts.reduce(
    (sum, text) => sum + ctx.measureText(text).width,
    0,
  );
  // Compact the heading when an English date or large totals would collide.
  const totalY =
    28 + dateWidth + ctx.measureText(` · D+${age}`).width + 8 > 372 - fullWidth
      ? 49
      : 33;
  const top = totalY === 49 ? 64 : 50;
  const extra = top - 50;
  let x = 372 - fullWidth;
  amounts.forEach((text, index) => {
    ctx.fillStyle =
      index === 1
        ? '#417bc0'
        : index === 3
          ? '#b77522'
          : index === 2
            ? muted
            : ink;
    ctx.fillText(text, x, totalY);
    x += ctx.measureText(text).width;
  });
  const rowHeight = (rows.length * 50 - extra) / rows.length;
  rows.forEach((row, index) => {
    const y = top + index * rowHeight,
      cy = y + 21;
    const icon = icons[index];
    ctx.strokeStyle = '#e1e6fc';
    ctx.lineWidth = 2;
    if (index < rows.length - 1) {
      ctx.beginPath();
      ctx.moveTo(96, cy + 7);
      ctx.lineTo(96, cy + rowHeight - 7);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(96, cy, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = 'left';
    font(14);
    ctx.fillStyle = '#5568bd';
    ctx.fillText(row.time, 28, cy + 5);
    if (row.startDay) {
      font(9);
      ctx.fillStyle = muted;
      ctx.fillText(row.startDay, 28, cy + 19);
    }
    rounded(114, y, 258, 43, 11);
    ctx.fillStyle = icon.background;
    ctx.fill();
    ctx.drawImage(icon.image, 128, y + 12, 19, 19);
    ctx.fillStyle = cardInk;
    font(12, true);
    const title = fit(ctx, row.label, 184);
    ctx.fillText(title, 158, y + 26);
    const titleWidth = ctx.measureText(title).width;
    font(10);
    ctx.fillStyle = cardMuted;
    const available = 348 - (163 + titleWidth);
    if (row.detail && ctx.measureText(row.detail).width <= available)
      ctx.fillText(row.detail, 163 + titleWidth, y + 26);
    else if (row.detail) {
      // Two lines inside the same compact card preserve long medicine/gift details.
      ctx.fillStyle = icon.background;
      ctx.fillRect(157, y + 5, 189, 30);
      ctx.fillStyle = cardInk;
      font(11, true);
      ctx.fillText(fit(ctx, row.label, 184), 158, y + 18);
      ctx.fillStyle = cardMuted;
      font(9);
      ctx.fillText(fit(ctx, row.detail, 184), 158, y + 32);
    }
    ctx.strokeStyle = cardMuted;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(354, y + 18);
    ctx.lineTo(358, y + 22);
    ctx.lineTo(354, y + 26);
    ctx.stroke();
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = muted;
  font(10);
  ctx.fillText(
    `podoong${total > 1 ? ` · ${page + 1}/${total}` : ''}`,
    200,
    height - 12,
  );
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Export failed'))),
      'image/png',
    ),
  );
  return new File([blob], `daily-records-${day}-${page + 1}.png`, {
    type: 'image/png',
  });
}
