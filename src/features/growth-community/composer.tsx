'use client';
import { AttachmentPreview, type DiaryAttachment } from './attachment-preview';
import { PatternAttachment } from './pattern-attachment';
import { RecordAttachment } from './record-attachment';
import { createRecordId } from '@/lib/record-id';
import { useEffect, useRef, useState, useId, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine, Check, ImagePlus, Ellipsis, Trash2 } from 'lucide-react';
import { createDiary, removeDiary } from './composer-action';
import { prepareCommunityPhoto } from '@/features/community/prepare-photo';

export function DiaryComposer({
  child,
  locale,
  record,
  trigger,
  triggerClassName,
  triggerLabel,
  disabled,
  onSaved,
  privacy,
  firstEntry = false,
}: {
  privacy: { health: boolean; publicSharing: boolean };
  firstEntry?: boolean;
  child: string;
  locale: 'ko' | 'en';
  trigger?: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  disabled?: boolean;
  onSaved?: (occurredAt?: string) => void;
  record?: {
    id: string;
    version: number;
    note: string;
    weight_kg: number | null;
    height_cm: number | null;
    head_cm: number | null;
    photo_ids: string[];
    is_private: boolean;
    occurred_at?: string;
  };
}) {
  const ko = locale === 'ko';
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useRef('');
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [publish, setPublish] = useState(record ? !record.is_private : false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRoot = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!menuOpen) return;
    menuRoot.current
      ?.querySelector<HTMLButtonElement>('.diary-menu-options button')
      ?.focus();
    function dismiss(event: PointerEvent) {
      if (!menuRoot.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<DiaryAttachment[]>([]);
  const [patternBusy, setPatternBusy] = useState(false);

  useEffect(() => {
    if (!opened) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    heading.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [opened]);
  function open() {
    setPublish(record ? !record.is_private : false);
    setAttachments((record?.photo_ids ?? []).map((id) => ({ key: id, id })));
    setOpened(true);
    id.current = record?.id ?? createRecordId();
    setMenuOpen(false);
    setConfirmDelete(false);
    form.current?.reset();
    setError('');

    dialog.current?.showModal();
  }
  async function submit(data: FormData) {
    if (patternBusy) return;
    setPending(true);
    setError('');
    data.set('id', id.current);
    data.set('childId', child);
    data.set('locale', locale);
    if (record) data.set('version', String(record.version));
    const occurredAt = record?.occurred_at ?? new Date().toISOString();
    data.set('occurredAt', occurredAt);
    data.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    try {
      data.delete('photo');
      const order: string[] = [];
      let nextFile = 0;
      try {
        // Decode one at a time to keep phone memory usage bounded.
        for (const item of attachments) {
          if (item.id) order.push(item.id);
          else {
            data.append('photo', await prepareCommunityPhoto(item.file!));
            order.push(`new:${nextFile++}`);
          }
        }
      } catch {
        setError(
          ko
            ? '사진을 준비하지 못했어요. 첨부 사진을 확인하고 다시 시도해 주세요.'
            : 'Could not prepare a photo. Check your attachments and try again.',
        );
        return;
      }
      data.set('photoOrder', JSON.stringify(order));
      const result = await createDiary(data);
      if (result.saved) {
        dialog.current?.close();
        if (onSaved) onSaved(occurredAt);
        else router.refresh();
      } else
        setError(
          result.error === 'photo-limit'
            ? ko
              ? '사진은 기존 사진을 포함해 최대 9장까지 올릴 수 있어요.'
              : 'A diary can contain up to 9 photos, including existing photos.'
            : result.error === 'birth'
              ? ko
                ? '공개하려면 아이의 출생일과 기록 시각을 확인해 주세요. 비공개로도 저장할 수 있어요.'
                : 'Check the birth date and record time to publish, or save privately.'
              : result.error === 'empty'
                ? ko
                  ? '글, 사진 또는 성장 수치를 입력해 주세요.'
                  : 'Add a note, photo, or measurement.'
                : ko
                  ? '입력값과 사진 형식을 확인하고 다시 저장해 주세요.'
                  : 'Check the fields and photo format, then try again.',
        );
    } catch {
      setError(
        ko
          ? '저장하지 못했어요. 다시 시도해 주세요.'
          : 'Could not save. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }
  async function deleteEntry() {
    if (!record) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setPending(true);
    setError('');
    try {
      const data = new FormData();
      data.set('id', record.id);
      data.set('child', child);
      data.set('locale', locale);
      if (!(await removeDiary(data))) throw new Error('delete');
      setMenuOpen(false);
      dialog.current?.close();
      if (onSaved) onSaved(record.occurred_at);
      else router.refresh();
    } catch {
      setError(
        ko
          ? '삭제하지 못했어요. 다시 시도해 주세요.'
          : 'Could not delete. Please try again.',
      );
    } finally {
      setPending(false);
    }
  }
  const title = record
    ? ko
      ? '일기 관리'
      : 'Manage diary'
    : ko
      ? '일기 쓰기'
      : 'Write a diary';
  return (
    <div
      ref={menuRoot}
      className={
        trigger
          ? 'quick-diary-entry'
          : record
            ? 'diary-manage-entry'
            : 'diary-compose-entry'
      }
    >
      <button
        ref={menuButton}
        type="button"
        className={
          triggerClassName ??
          (record ? 'diary-manage-icon' : 'diary-compose-add')
        }
        disabled={disabled}
        onClick={
          record && !trigger
            ? () => {
                setMenuOpen(!menuOpen);
                setConfirmDelete(false);
                setError('');
              }
            : open
        }
        aria-expanded={record && !trigger ? menuOpen : undefined}
        aria-controls={record && !trigger ? menuId : undefined}
        aria-label={triggerLabel ?? title}
      >
        {trigger ?? (record ? <Ellipsis size={22} /> : <PenLine size={24} />)}
      </button>
      {record && !trigger && menuOpen && (
        <div
          id={menuId}
          className="diary-menu-options diary-own-menu"
          role="group"
          aria-label={title}
        >
          <button type="button" disabled={pending} onClick={open}>
            <PenLine size={17} aria-hidden="true" />
            {ko ? '편집' : 'Edit'}
          </button>
          <button
            type="button"
            className="diary-delete-option"
            disabled={pending}
            onClick={deleteEntry}
          >
            <Trash2 size={17} aria-hidden="true" />
            {confirmDelete
              ? ko
                ? '삭제 확인'
                : 'Confirm delete'
              : ko
                ? '삭제'
                : 'Delete'}
          </button>
          {confirmDelete && (
            <p>
              {ko
                ? '일기와 사진을 삭제할까요?'
                : 'Delete this diary and its photos?'}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <dialog
        ref={dialog}
        onClose={() => setOpened(false)}
        className="diary-compose-sheet"
        aria-label={title}
        onCancel={(event) => {
          if (pending || patternBusy) event.preventDefault();
        }}
      >
        {(!record || opened) && (
          <>
            <header className="quick-composer-heading">
              <span className="quick-kind-badge">
                <PenLine size={19} aria-hidden="true" />
              </span>
              <h2 ref={heading} tabIndex={-1}>
                {title}
              </h2>
            </header>
            <form
              ref={form}
              onSubmit={(event) => {
                event.preventDefault();
                if (!pending) void submit(new FormData(event.currentTarget));
              }}
            >
              <fieldset disabled={pending || patternBusy}>
                {!record && firstEntry && (
                  <div className="diary-first-guide">
                    <strong>
                      {ko
                        ? '사진 한 장, 한마디부터'
                        : 'Start with a photo or a few words'}
                    </strong>
                    <p>
                      {ko
                        ? '오늘 기억하고 싶은 모습을 남겨보세요. 성장 수치는 비워도 괜찮아요.'
                        : 'Keep one moment you want to remember today. Growth measurements are optional.'}
                    </p>
                  </div>
                )}
                <div className="diary-compose-basics">
                  <div className="diary-compose-measures">
                    {(
                      [
                        {
                          name: 'weight',
                          label: ko ? '몸무게' : 'Weight',
                          unit: 'kg',
                          max: 200,
                        },
                        {
                          name: 'height',
                          label: ko ? '키' : 'Height',
                          unit: 'cm',
                          max: 250,
                        },
                        {
                          name: 'head',
                          label: ko ? '머리둘레' : 'Head circumference',
                          unit: 'cm',
                          max: 100,
                        },
                      ] as const
                    ).map(({ name, label, unit, max }) => (
                      <label key={name}>
                        <span className="diary-measure-label">
                          {label}
                          <span>{ko ? '선택' : 'Optional'}</span>
                        </span>
                        <input
                          type="number"
                          name={name}
                          disabled={!privacy.health}
                          defaultValue={
                            record?.[
                              name === 'weight'
                                ? 'weight_kg'
                                : name === 'height'
                                  ? 'height_cm'
                                  : 'head_cm'
                            ] ?? ''
                          }
                          min="0.01"
                          max={max}
                          step="0.01"
                          inputMode="decimal"
                          aria-label={label}
                          placeholder={unit}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="diary-privacy-option">
                    <input
                      type="checkbox"
                      name="publish"
                      checked={publish}
                      onChange={(event) => setPublish(event.target.checked)}
                    />
                    {ko ? '공개하기' : 'Publish'}
                  </label>
                </div>
                {publish && (
                  <p className="small muted">
                    {ko
                      ? '공개된 성장일기는 다른 초보 부모들에게 많은 도움이 됩니다.'
                      : 'Your public growth diary can be a great help to other new parents.'}
                  </p>
                )}
                {!privacy.health && (
                  <p className="small muted">
                    {ko
                      ? '건강정보 동의를 하지 않았다면 본문·사진에도 건강정보를 넣지 마세요.'
                      : 'If you declined health processing, do not include health details in text or photos.'}
                  </p>
                )}
                <label className="diary-note-field">
                  <span>{ko ? '일기 내용' : 'Diary note'}</span>
                  <textarea
                    name="note"
                    defaultValue={record?.note}
                    aria-label={ko ? '일기 내용' : 'Diary note'}
                    placeholder={
                      ko
                        ? '아이의 하루를 남겨 주세요'
                        : 'Capture your child’s day'
                    }
                    maxLength={2000}
                    rows={4}
                  />
                </label>
                <div className="diary-attachment-tools">
                  <label className="diary-photo-picker">
                    <ImagePlus size={20} />
                    {ko ? '사진 추가' : 'Add photo'}
                    <span className="diary-photo-count">
                      {attachments.length}/9
                    </span>
                    <input
                      type="file"
                      multiple
                      disabled={attachments.length >= 9}
                      accept="image/*,.heic,.heif"
                      aria-label={ko ? '사진 추가' : 'Add photo'}
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        event.target.value = '';
                        if (attachments.length + files.length > 9) {
                          setError(
                            ko
                              ? '사진은 하루 패턴·하루 기록을 포함해 최대 9장까지 올릴 수 있어요.'
                              : 'Up to 9 photos, including daily patterns and records.',
                          );
                          return;
                        }
                        setError('');
                        setAttachments((items) => [
                          ...items,
                          ...files.map((file) => ({
                            key: createRecordId(),
                            file,
                          })),
                        ]);
                      }}
                    />
                  </label>
                  <PatternAttachment
                    key={String(opened)}
                    child={child}
                    locale={locale}
                    full={attachments.length >= 9}
                    onChange={(file) =>
                      setAttachments((items) => [
                        ...items,
                        { key: createRecordId(), file },
                      ])
                    }
                    onBusy={setPatternBusy}
                  />
                  <RecordAttachment
                    key={`records-${opened}`}
                    child={child}
                    locale={locale}
                    remaining={9 - attachments.length}
                    onChange={(files) =>
                      setAttachments((items) => [
                        ...items,
                        ...files.map((file) => ({
                          key: createRecordId(),
                          file,
                        })),
                      ])
                    }
                    onBusy={setPatternBusy}
                  />
                </div>
                <div className="diary-attachment-grid">
                  {attachments.map((item, index) => (
                    <AttachmentPreview
                      key={item.key}
                      item={item}
                      index={index}
                      count={attachments.length}
                      locale={locale}
                      onMove={(direction) =>
                        setAttachments((items) => {
                          const next = [...items];
                          [next[index], next[index + direction]] = [
                            next[index + direction],
                            next[index],
                          ];
                          return next;
                        })
                      }
                      onRemove={() =>
                        setAttachments((items) =>
                          items.filter((value) => value.key !== item.key),
                        )
                      }
                    />
                  ))}
                </div>
              </fieldset>
              {error && <p role="alert">{error}</p>}
              <footer className="quick-composer-footer">
                <button
                  type="button"
                  className="button secondary quick-cancel"
                  disabled={pending || patternBusy}
                  onClick={() => dialog.current?.close()}
                >
                  {ko ? '취소' : 'Cancel'}
                </button>
                {record && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={pending || patternBusy}
                    onClick={deleteEntry}
                  >
                    {confirmDelete
                      ? ko
                        ? '삭제 확인'
                        : 'Confirm delete'
                      : ko
                        ? '삭제'
                        : 'Delete'}
                  </button>
                )}
                <button
                  type="submit"
                  className="button primary quick-confirm"
                  disabled={pending || patternBusy}
                  aria-busy={pending}
                >
                  <Check size={18} aria-hidden="true" />
                  {pending
                    ? ko
                      ? '저장 중…'
                      : 'Saving…'
                    : ko
                      ? '저장'
                      : 'Save'}
                </button>
              </footer>
            </form>
          </>
        )}
      </dialog>
    </div>
  );
}
