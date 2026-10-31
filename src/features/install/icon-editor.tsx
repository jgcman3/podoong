'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Camera, Check, RotateCcw } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { saveAppIcon } from './actions';
import styles from './install.module.css';

export function IconEditor({
  locale,
  child,
  name,
  token,
  editable,
}: {
  locale: Locale;
  child: string;
  name: string;
  token?: string;
  editable: boolean;
}) {
  const ko = locale === 'ko';
  const canvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 50, y: 50, zoom: 1 });
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, startTransition] = useTransition();
  useEffect(() => {
    // Installation must start on a fresh document: an earlier browser prompt
    // can otherwise retain the generic manifest from before the photo upload.
    const url = new URL(window.location.href);
    if (!url.searchParams.has('ready')) {
      window.location.replace(
        `/api/prepare-install?locale=${locale}&child=${encodeURIComponent(child)}${url.searchParams.has('error') ? '&error=photo' : ''}`,
      );
    }
  }, [token, locale, child]);
  useEffect(() => {
    if (!source) return;
    const loaded = new Image();
    loaded.onload = () => {
      image.current = loaded;
      setCrop({ x: 50, y: 50, zoom: 1 });
      setReady(true);
    };
    loaded.onerror = () => setError(true);
    loaded.src = source;
    return () => {
      loaded.onload = null;
      URL.revokeObjectURL(source);
    };
  }, [source]);
  useEffect(() => {
    const target = canvas.current,
      photo = image.current;
    if (!target || !photo || !source) return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const side = Math.min(photo.naturalWidth, photo.naturalHeight) / crop.zoom;
    ctx.fillStyle = '#fff3e6';
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(
      photo,
      ((photo.naturalWidth - side) * crop.x) / 100,
      ((photo.naturalHeight - side) * crop.y) / 100,
      side,
      side,
      0,
      0,
      512,
      512,
    );
  }, [crop, source, ready]);
  function apply() {
    canvas.current?.toBlob((blob) => {
      if (!blob) {
        setError(true);
        return;
      }
      const form = new FormData();
      form.set('locale', locale);
      form.set('child', child);
      form.set('photo', blob, 'app-icon.png');
      startTransition(async () => {
        await saveAppIcon(form);
      });
    }, 'image/png');
  }
  return (
    <div className={styles.editor}>
      <div className={styles.preview}>
        {source ? (
          <canvas
            ref={canvas}
            width={512}
            height={512}
            aria-label={ko ? '아이콘 미리보기' : 'Icon preview'}
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- Private capability URL or local brand asset. */
          <img
            src={
              token
                ? `/api/app-icon/${token}/192`
                : '/icons/podung-192.png?v=full-20261029'
            }
            alt={ko ? '홈 화면 아이콘 미리보기' : 'Home Screen icon preview'}
            width={112}
            height={112}
          />
        )}
        <strong>{name}</strong>
      </div>
      {editable && (
        <>
          <label className={styles.upload}>
            <Camera size={18} />
            {ko ? '아이 사진 선택' : 'Choose child’s photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setError(true);
                  return;
                }
                image.current = null;
                setReady(false);
                setError(false);
                setSource(URL.createObjectURL(file));
              }}
            />
          </label>
          {source && (
            <div className={styles.adjust}>
              {(['zoom', 'x', 'y'] as const).map((axis) => (
                <label key={axis}>
                  {axis === 'zoom'
                    ? ko
                      ? '확대'
                      : 'Zoom'
                    : axis === 'x'
                      ? ko
                        ? '좌우'
                        : 'Horizontal'
                      : ko
                        ? '위아래'
                        : 'Vertical'}
                  <input
                    type="range"
                    min={axis === 'zoom' ? 1 : 0}
                    max={axis === 'zoom' ? 3 : 100}
                    step={axis === 'zoom' ? 0.01 : 1}
                    value={crop[axis]}
                    onChange={(event) =>
                      setCrop((current) => ({
                        ...current,
                        [axis]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                className="button primary"
                onClick={apply}
                disabled={busy || !ready}
              >
                <Check size={18} />
                {ko ? '이 사진으로 적용' : 'Apply photo'}
              </button>
            </div>
          )}
          {token && !source && (
            <form action={saveAppIcon}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="child" value={child} />
              <input type="hidden" name="remove" value="yes" />
              <button className={styles.reset}>
                <RotateCcw size={14} />
                {ko ? '기본 아이콘으로' : 'Use default icon'}
              </button>
            </form>
          )}
          <small className={styles.note}>
            {ko
              ? '원본은 보관하지 않아요. 아이콘 링크를 아는 사람은 아이콘 이미지를 볼 수 있어요.'
              : 'We keep only the processed icon, not the original. Anyone with its link can view the icon image.'}
          </small>
        </>
      )}
      {error && (
        <p role="alert">
          {ko
            ? '5MB 이하의 JPG, PNG, WebP 사진을 선택해주세요.'
            : 'Choose a JPG, PNG or WebP photo under 5MB.'}
        </p>
      )}
    </div>
  );
}
