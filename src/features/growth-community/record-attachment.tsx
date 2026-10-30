'use client';
import { useId, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { diaryDayRecords } from './pattern-action';
import { recordImagePages } from './record-image-model';
import { recordImage } from './record-image';
import { localDateInput } from '@/features/care/quick-model';

export function RecordAttachment({
  child,
  locale,
  remaining,
  onChange,
  onBusy,
}: {
  child: string;
  locale: 'ko' | 'en';
  remaining: number;
  onChange: (files: File[]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const ko = locale === 'ko',
    controlsId = useId();
  const [day, setDay] = useState(() =>
    localDateInput(new Date().toISOString()).slice(0, 10),
  );
  const [opened, setOpened] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function attach() {
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const data = await diaryDayRecords({ child, locale, day });
      const pages = recordImagePages(data.rows);
      if (!pages.length) {
        setError(
          ko
            ? '이 날짜에는 표시할 기록이 없어요.'
            : 'No records to display for this date.',
        );
        return;
      }
      if (pages.length > remaining) {
        setError(
          ko
            ? `하루 기록은 ${pages.length}장으로 나뉘어요. 첨부 공간을 확보해 주세요. (최대 9장)`
            : `These records need ${pages.length} images. Make room within the 9-photo limit.`,
        );
        return;
      }
      const files: File[] = [];
      for (const [index, rows] of pages.entries())
        files.push(
          await recordImage(
            rows,
            day,
            data.age,
            data.feeding,
            index,
            pages.length,
            locale,
          ),
        );
      onChange(files);
      setOpened(false);
    } catch {
      setError(
        ko
          ? '기록을 불러오지 못했어요. 다시 시도해 주세요.'
          : 'Could not load records. Please retry.',
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
        disabled={!remaining || busy}
        onClick={() => setOpened(!opened)}
        aria-label={ko ? '하루 기록 올리기' : 'Attach daily records'}
        aria-expanded={opened}
        aria-controls={opened ? controlsId : undefined}
      >
        <ListChecks size={18} />
        {ko ? '하루 기록' : 'Daily records'}
      </button>
      {opened && (
        <div id={controlsId} className="diary-pattern-controls">
          <input
            type="date"
            value={day}
            max={localDateInput(new Date().toISOString()).slice(0, 10)}
            onChange={(event) => setDay(event.target.value)}
            aria-label={ko ? '기록 날짜' : 'Record date'}
          />
          <button
            className="button primary"
            type="button"
            disabled={busy || !remaining || !day}
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
