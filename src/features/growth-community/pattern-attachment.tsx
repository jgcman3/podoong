'use client';
import { useId, useState } from 'react';
import { ChartPie } from 'lucide-react';
import { diaryPattern } from './pattern-action';
import { kindName } from '@/features/insights/config';
import { localDateInput } from '@/features/care/quick-model';

export function PatternAttachment({
  child,
  locale,
  full,
  onChange,
  onBusy,
}: {
  child: string;
  locale: 'ko' | 'en';
  full: boolean;
  onChange: (file: File) => void;
  onBusy: (busy: boolean) => void;
}) {
  const ko = locale === 'ko';
  const controlsId = useId();
  const [day, setDay] = useState(() =>
    localDateInput(new Date().toISOString()).slice(0, 10),
  );
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function attach() {
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const { categories, summary, age } = await diaryPattern({
        child,
        locale,
        day,
      });
      if (!categories.length) {
        setError(
          ko
            ? '이 날짜에는 표시할 기록이 없어요.'
            : 'No records to display for this date.',
        );
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = 1800;
      canvas.height = 2400;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#fffaf4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#344256';
      ctx.textAlign = 'center';
      ctx.font = '44px sans-serif';
      ctx.fillText(
        new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'short',
          timeZone: 'UTC',
        }).format(new Date(`${day}T00:00:00Z`)),
        canvas.width / 2,
        200,
      );
      const cx = canvas.width / 2,
        cy = 1080,
        radius = 520,
        width = 320;
      ctx.strokeStyle = '#edf2f8';
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      const colors = new Map<string, string>();
      for (const category of [...categories].sort(
        (a, b) => Number(b.kind === 'sleep') - Number(a.kind === 'sleep'),
      )) {
        const swatch = document.createElement('span');
        swatch.className = `quick-color-${category.kind}`;
        document.body.append(swatch);
        const color =
          getComputedStyle(swatch).getPropertyValue('--care-ink').trim() ||
          '#64748b';
        swatch.remove();
        colors.set(category.kind, color);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'butt';
        ctx.globalAlpha = category.kind === 'sleep' ? 0.45 : 0.9;
        for (const segment of category.segments) {
          ctx.beginPath();
          ctx.arc(
            cx,
            cy,
            radius,
            (segment.start / 1440) * Math.PI * 2 - Math.PI / 2,
            (Math.min(1440, Math.max(segment.end, segment.start + 9)) / 1440) *
              Math.PI *
              2 -
              Math.PI / 2,
          );
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '40px sans-serif';
      for (let hour = 0; hour < 24; hour += 2) {
        const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
        ctx.fillText(
          String(hour),
          cx + Math.cos(angle) * 740,
          cy + Math.sin(angle) * 740 + 9,
        );
      }
      ctx.font = 'bold 50px sans-serif';
      ctx.fillText(`D+${age}`, cx, cy + 10);
      // Keep every legend item on a single centered line, even in English.
      ctx.font = '36px sans-serif';
      const legendWidths = categories.map(
        (category) =>
          ctx.measureText(kindName(category.kind, locale)).width + 64,
      );
      const legendWidth = legendWidths.reduce((sum, width) => sum + width, 0);
      const legendScale = Math.min(1, (canvas.width - 100) / legendWidth);
      ctx.save();
      ctx.translate(
        (canvas.width - legendWidth * legendScale) / 2,
        canvas.height - 170,
      );
      ctx.scale(legendScale, legendScale);
      ctx.textAlign = 'left';
      let legendX = 0;
      categories.forEach((category, index) => {
        ctx.fillStyle = colors.get(category.kind)!;
        ctx.beginPath();
        ctx.arc(legendX + 10, -10, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#52616a';
        ctx.fillText(kindName(category.kind, locale), legendX + 32, 0);
        legendX += legendWidths[index];
      });
      ctx.restore();
      const hours = Math.floor(summary.sleepMinutes / 60);
      const minutes = summary.sleepMinutes % 60;
      const totals = [
        {
          label: ko ? '총 먹은 양' : 'Total intake',
          value: `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(summary.feedingMl)} ml`,
          color: '#417bc0',
        },
        {
          label: ko ? '배변 횟수' : 'Bowel movements',
          value: ko ? `${summary.stoolCount}회` : String(summary.stoolCount),
          color: '#b77522',
        },
        {
          label: ko ? '총 수면 시간' : 'Total sleep',
          value: ko
            ? `${hours ? `${hours}시간 ` : ''}${minutes}분`
            : `${hours}h ${minutes}m`,
          color: '#7964bd',
        },
      ];
      ctx.textAlign = 'center';
      totals.forEach((total, index) => {
        const x = 360 + index * 540;
        ctx.fillStyle = '#78828c';
        ctx.font = '36px sans-serif';
        ctx.fillText(total.label, x, 1975);
        ctx.fillStyle = total.color;
        ctx.font = 'bold 52px sans-serif';
        ctx.fillText(total.value, x, 2060, 470);
      });
      ctx.textAlign = 'center';
      ctx.font = '32px sans-serif';
      ctx.fillStyle = '#8b715e';
      ctx.fillText('podoong', canvas.width / 2, canvas.height - 65);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error('Export failed')),
          'image/png',
        ),
      );
      onChange(
        new File([blob], `daily-pattern-${day}.png`, { type: 'image/png' }),
      );
      setOpened(false);
    } catch {
      setError(
        ko
          ? '패턴을 불러오지 못했어요. 다시 시도해 주세요.'
          : 'Could not load the pattern. Please retry.',
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="diary-pattern-attachment">
      <button
        type="button"
        className="button secondary"
        disabled={full || busy}
        onClick={() => setOpened(!opened)}
        aria-label={ko ? '하루 패턴 올리기' : 'Attach daily pattern'}
        aria-expanded={opened}
        aria-controls={opened ? controlsId : undefined}
      >
        <ChartPie size={18} />
        {ko ? '하루 패턴' : 'Daily pattern'}
      </button>
      {opened && (
        <div id={controlsId} className="diary-pattern-controls">
          <input
            type="date"
            value={day}
            max={localDateInput(new Date().toISOString()).slice(0, 10)}
            onChange={(event) => setDay(event.target.value)}
            aria-label={ko ? '패턴 날짜' : 'Pattern date'}
          />
          <button
            className="button primary"
            type="button"
            disabled={busy || full || !day}
            onClick={attach}
          >
            {busy ? (ko ? '불러오는 중' : 'Loading') : ko ? '첨부' : 'Attach'}
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
