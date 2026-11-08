'use client';
import Image from 'next/image';
import { trackServiceAction } from '@/features/admin/track-action';
import { useEffect, useId, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import {
  createMomentImage,
  readMomentPhoto,
  momentDesigns,
  shortMoment,
  type MomentDesign,
} from './moment-image';
import styles from './moment-share.module.css';
import { filteredMomentPhoto, type MomentFilter } from './moment-filter';

type Moment = {
  name: string;
  age: number | null;
  note: string;
  date: string;
  photos: string[];
  locale: Locale;
};
export function MomentShare(props: Moment) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const ko = props.locale === 'ko';
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
      >
        <Share2 size={16} aria-hidden="true" />
        {ko ? '이 순간 전하기' : 'Share this moment'}
      </button>
      {open && (
        <MomentEditor
          {...props}
          close={() => {
            setOpen(false);
            trigger.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
}
function MomentEditor({
  name: initialName,
  age,
  note,
  date,
  photos,
  locale,
  close,
}: Moment & { close: () => void }) {
  const ko = locale === 'ko',
    title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const historyId = useId();
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    if (window.history.state?.momentShare !== historyId)
      window.history.pushState(
        { ...window.history.state, momentShare: historyId },
        '',
        window.location.href,
      );
    const pop = () => {
      if (window.history.state?.momentShare !== historyId) {
        dialog.current?.close();
        closeRef.current();
      }
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [historyId]);
  const dismiss = () => {
    if (window.history.state?.momentShare === historyId) window.history.back();
    else {
      dialog.current?.close();
      close();
    }
  };
  const [name, setName] = useState(shortMoment(initialName, 30));
  const [text, setText] = useState(shortMoment(note));
  const [design, setDesign] = useState<MomentDesign>('cinema');
  const photoCache = useRef(new Map<string, Blob>());
  const filteredPhoto = useRef<{ key: string; image: Blob } | undefined>(
    undefined,
  );
  const [photoFilter, setPhotoFilter] = useState<MomentFilter>('original');
  const [filterStrength, setFilterStrength] = useState(55);
  const [showAge, setShowAge] = useState(age !== null);
  const [photo, setPhoto] = useState<string | undefined>(photos[0]);
  const [asset, setAsset] = useState<{
    file: File;
    url: string;
    truncated: boolean;
  }>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(true),
    [sharing, setSharing] = useState(false);
  const [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    const current = dialog.current;
    current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      current?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    const timer = setTimeout(() => {
      setBusy(true);
      setError('');
      setMessage('');
      const build = async () => {
        let image = photo ? photoCache.current.get(photo) : undefined;
        if (photo && !image) {
          image = await readMomentPhoto(photo, controller.signal);
          photoCache.current.set(photo, image);
        }
        if (photo && image && photoFilter !== 'original') {
          const key = `${photo}:${photoFilter}:${filterStrength}`;
          if (filteredPhoto.current?.key === key)
            image = filteredPhoto.current.image;
          else {
            image = await filteredMomentPhoto(
              image,
              filterStrength,
              controller.signal,
              photoFilter,
            );
            filteredPhoto.current = { key, image };
          }
        }
        return createMomentImage({
          name,
          age: showAge ? age : null,
          text,
          date,
          photo: image,
          locale,
          design,
          signal: controller.signal,
        });
      };
      void build()
        .then((result) => {
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(result.file);
          setAsset({ ...result, url: objectUrl });
          setBusy(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setBusy(false);
          setAsset(undefined);
          setError(
            ko
              ? '카드를 만들지 못했어요. 다른 사진을 선택하거나 사진 없이 다시 시도해 주세요.'
              : 'Could not create the card. Choose another photo or try without one.',
          );
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    name,
    age,
    showAge,
    text,
    date,
    photo,
    locale,
    ko,
    revision,
    design,
    photoFilter,
    filterStrength,
  ]);
  const change = () => {
    setBusy(true);
    setMessage('');
  };
  async function share() {
    if (!asset || busy || sharing) return;
    const payload = { files: [asset.file] };
    if (!window.isSecureContext) {
      setMessage(
        ko
          ? '이 주소에서는 시스템 공유를 사용할 수 없어요. HTTPS 주소에서 열거나 이미지를 저장해 보내주세요.'
          : 'System sharing requires a secure HTTPS address. You can save the image and send it instead.',
      );
      return;
    }
    if (
      !navigator.share ||
      (navigator.canShare && !navigator.canShare(payload))
    ) {
      setMessage(
        ko
          ? '이 브라우저는 이미지 공유를 지원하지 않아요. 이미지를 저장한 뒤 원하는 앱에서 보내주세요.'
          : 'Image sharing is unavailable here. Save the image and send it from your preferred app.',
      );
      return;
    }
    setSharing(true);
    setMessage('');
    try {
      trackServiceAction('moment_share_attempt');
      await navigator.share(payload);
    } catch (error) {
      if ((error as Error | null)?.name !== 'AbortError')
        setMessage(
          ko
            ? '공유하지 못했어요. 이미지 저장으로도 보낼 수 있어요.'
            : 'Could not share. You can save the image instead.',
        );
    } finally {
      setSharing(false);
    }
  }
  function download() {
    if (!asset || busy) return;
    const link = document.createElement('a');
    link.href = asset.url;
    link.download = asset.file.name;
    document.body.append(link);
    link.click();
    trackServiceAction('moment_save_attempt');
    link.remove();
    setMessage(
      ko
        ? '이미지 저장을 시작했어요. 저장한 이미지를 지인에게 보내보세요.'
        : 'Your image download has started. Send it to someone you care about.',
    );
  }
  return (
    <dialog
      ref={dialog}
      className={styles.sheet}
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }}
    >
      <header>
        <h2 id={title}>{ko ? '이 순간 전하기' : 'Share this moment'}</h2>
        <button
          type="button"
          aria-label={ko ? '닫기' : 'Close'}
          onClick={() => {
            dismiss();
          }}
        >
          <X size={20} />
        </button>
      </header>
      <div className={styles.body}>
        <section className={styles.studio}>
          <div className={styles.preview} aria-busy={busy}>
            {asset && (
              <Image
                unoptimized
                src={asset.url}
                width={1080}
                height={1350}
                alt={ko ? '공유 카드 미리보기' : 'Share card preview'}
              />
            )}
            {!asset && !error && (
              <p role="status">
                {ko ? '카드를 만들고 있어요…' : 'Creating your card…'}
              </p>
            )}
          </div>
          <fieldset className={styles.designs}>
            <legend>{ko ? '카드 디자인' : 'Card design'}</legend>
            {momentDesigns.map((option) => (
              <button
                type="button"
                key={option.id}
                aria-pressed={design === option.id}
                onClick={() => {
                  if (design === option.id) return;
                  change();
                  setDesign(option.id);
                }}
              >
                <span
                  className={styles.designSwatch}
                  data-design={option.id}
                  style={{ background: option.background }}
                  aria-hidden="true"
                >
                  <i
                    style={{
                      background: option.paper,
                      borderColor: option.accent,
                    }}
                  >
                    <b style={{ background: option.photo }}>
                      {photo && (
                        <Image
                          unoptimized
                          src={`${photo}?size=480`}
                          alt=""
                          width={48}
                          height={60}
                        />
                      )}
                    </b>
                  </i>
                </span>
                <span>{ko ? option.ko : option.en}</span>
              </button>
            ))}
          </fieldset>
          {photo && (
            <fieldset className={styles.filters}>
              <legend>{ko ? '사진 필터' : 'Photo filter'}</legend>
              <div className={styles.filterChoices}>
                {(
                  [
                    ['original', ko ? '원본' : 'Original'],
                    ['rosy', ko ? '발그레 필름' : 'Rosy film'],
                    ['sunlight', ko ? '맑은 햇살' : 'Clear sunlight'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={photoFilter === id}
                    onClick={() => {
                      if (photoFilter === id) return;
                      change();
                      setPhotoFilter(id);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {photoFilter !== 'original' && (
                <>
                  <label>
                    {ko ? '필터 강도' : 'Filter strength'}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={filterStrength}
                      onChange={(event) => {
                        change();
                        setFilterStrength(Number(event.target.value));
                      }}
                    />
                  </label>
                </>
              )}
            </fieldset>
          )}
        </section>
        {asset?.truncated && (
          <p className={styles.notice}>
            {ko
              ? '긴 문구는 카드에 맞게 줄여 표시했어요. 미리보기를 확인해 주세요.'
              : 'Long text was shortened to fit. Check the preview before sharing.'}
          </p>
        )}
        <details className={styles.editDetails}>
          <summary>{ko ? '사진·문구 수정' : 'Edit photo & words'}</summary>
          <p className={styles.notice}>
            {ko
              ? '선택한 내용만 이미지로 만들어요. 일기 원문과 공개 설정은 바뀌지 않아요.'
              : 'Only your selections become an image. Your original diary and its visibility stay unchanged.'}
          </p>
          <fieldset className={styles.photos}>
            <legend>{ko ? '카드에 담을 사진' : 'Card photo'}</legend>
            <button
              type="button"
              aria-pressed={!photo}
              onClick={() => {
                if (!photo) return;
                change();
                setPhoto(undefined);
              }}
            >
              {ko ? '사진 없이' : 'No photo'}
            </button>
            {photos.map((url, index) => (
              <button
                key={url}
                type="button"
                aria-label={
                  ko ? `사진 ${index + 1} 선택` : `Choose photo ${index + 1}`
                }
                aria-pressed={photo === url}
                onClick={() => {
                  if (photo === url) return;
                  change();
                  setPhoto(url);
                }}
              >
                <Image
                  unoptimized
                  src={`${url}?size=480`}
                  alt=""
                  width={60}
                  height={60}
                />
              </button>
            ))}
          </fieldset>
          <label className={styles.field}>
            {ko ? '아이 애칭 (선택)' : 'Child nickname (optional)'}
            <input
              value={name}
              maxLength={60}
              onChange={(event) => {
                change();
                setName(event.target.value);
              }}
            />
          </label>
          {age !== null && (
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={showAge}
                onChange={(event) => {
                  change();
                  setShowAge(event.target.checked);
                }}
              />
              {ko ? 'D+일수 표시' : 'Show age in days'}
            </label>
          )}
          <label className={styles.field}>
            {ko ? '카드에 담을 문구' : 'Words for your card'}
            <textarea
              aria-label={ko ? '카드에 담을 문구' : 'Words for your card'}
              value={text}
              maxLength={320}
              rows={4}
              onChange={(event) => {
                change();
                setText(shortMoment(event.target.value));
              }}
            />
            <small>
              {ko
                ? '최대 160자. 공유하기 전에 사진과 문구를 확인해 주세요.'
                : 'Up to 160 characters. Review the photo and wording before sharing.'}
            </small>
          </label>
        </details>
        {error && (
          <div>
            <p role="alert">{error}</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                change();
                setRevision((value) => value + 1);
              }}
            >
              {ko ? '다시 만들기' : 'Try again'}
            </button>
          </div>
        )}
        {message && (
          <p role="status" className={styles.notice}>
            {message}
          </p>
        )}
      </div>
      <footer>
        <button
          type="button"
          className="button secondary"
          disabled={busy || !asset || sharing}
          onClick={download}
        >
          <Download size={17} />
          {ko ? '이미지 저장' : 'Save image'}
        </button>
        <button
          type="button"
          className="button"
          disabled={busy || !asset || sharing}
          onClick={() => void share()}
        >
          <Share2 size={17} />
          {ko ? '다른 앱에 공유' : 'Share to another app'}
        </button>
      </footer>
    </dialog>
  );
}
