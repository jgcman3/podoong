'use client';
import { createRecordId } from '@/lib/record-id';
import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PenLine, X, ImagePlus, Ellipsis } from 'lucide-react';
import Image from 'next/image';
import { createDiary, removeDiary } from './composer-action';

export function DiaryComposer({
  child,
  locale,
  record,
  trigger,
  triggerClassName,
  disabled,
  onSaved,
}: {
  child: string;
  locale: 'ko' | 'en';
  trigger?: ReactNode;
  triggerClassName?: string;
  disabled?: boolean;
  onSaved?: () => void;
  record?: {
    id: string;
    version: number;
    note: string;
    weight_kg: number | null;
    height_cm: number | null;
    head_cm: number | null;
    photo_ids: string[];
    is_private: boolean;
  };
}) {
  const ko = locale === 'ko';
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const id = useRef('');
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState(!record);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [photoName, setPhotoName] = useState('');
  function open() {
    setOpened(true);
    id.current = record?.id ?? createRecordId();
    setEditing(Boolean(trigger) || !record);
    setConfirmDelete(false);
    form.current?.reset();
    setError('');
    setPhotoName('');
    dialog.current?.showModal();
  }
  async function submit(data: FormData) {
    setPending(true);
    setError('');
    data.set('id', id.current);
    data.set('childId', child);
    data.set('locale', locale);
    if (record) data.set('version', String(record.version));
    data.set('occurredAt', new Date().toISOString());
    data.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
    try {
      const result = await createDiary(data);
      if (result.saved) {
        setWarning(
          result.error === 'photo'
            ? ko
              ? '일기는 저장했지만 사진을 올리지 못했어요. 일기 관리에서 다시 추가해 주세요.'
              : 'Diary saved, but the photo upload failed. Add it again in Manage diary.'
            : '',
        );
        dialog.current?.close();
        router.refresh();
        onSaved?.();
      } else
        setError(
          result.error === 'birth'
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
      dialog.current?.close();
      router.refresh();
      onSaved?.();
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
      className={
        trigger
          ? 'quick-diary-entry'
          : record
            ? 'diary-manage-entry'
            : 'diary-compose-entry'
      }
    >
      {warning && <p role="status">{warning}</p>}
      <button
        type="button"
        className={
          triggerClassName ??
          (record ? 'diary-manage-icon' : 'diary-compose-add')
        }
        disabled={disabled}
        onClick={open}
        aria-label={title}
      >
        {trigger ?? (record ? <Ellipsis size={22} /> : <PenLine size={24} />)}
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpened(false)}
        className="diary-compose-sheet"
        aria-label={title}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        {(!record || opened) && (
          <>
            <header>
              <h2>{title}</h2>
              <button
                type="button"
                disabled={pending}
                onClick={() => dialog.current?.close()}
                aria-label={ko ? '닫기' : 'Close'}
              >
                <X size={22} />
              </button>
            </header>
            {record && !editing ? (
              <div className="diary-manage-preview">
                {record.note && <p className="record-note">{record.note}</p>}
                <div className="diary-preview-metrics">
                  {[
                    [ko ? '몸무게' : 'Weight', record.weight_kg, 'kg'],
                    [ko ? '키' : 'Height', record.height_cm, 'cm'],
                    [
                      ko ? '머리둘레' : 'Head circumference',
                      record.head_cm,
                      'cm',
                    ],
                  ].map(
                    ([label, value, unit]) =>
                      value !== null && (
                        <span key={label}>
                          {label} {value} {unit}
                        </span>
                      ),
                  )}
                </div>
                <div className="public-diary-photos">
                  {record.photo_ids.map((photo) => (
                    <Image
                      key={photo}
                      src={`/api/care/photos/${photo}`}
                      alt={ko ? '일기 사진' : 'Diary photo'}
                      width={240}
                      height={240}
                      unoptimized
                    />
                  ))}
                </div>
                {error && <p role="alert">{error}</p>}
                {confirmDelete && (
                  <p role="alert">
                    {ko
                      ? '이 일기와 사진을 삭제할까요?'
                      : 'Delete this diary and its photos?'}
                  </p>
                )}
                <div className="diary-manage-actions">
                  <button
                    type="button"
                    className="button primary"
                    disabled={pending}
                    onClick={() => {
                      setEditing(true);
                      setConfirmDelete(false);
                      setError('');
                    }}
                  >
                    {ko ? '편집' : 'Edit'}
                  </button>
                  <button
                    type="button"
                    className="button"
                    disabled={pending}
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
                </div>
              </div>
            ) : (
              <form ref={form} action={submit}>
                <fieldset disabled={pending}>
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
                    rows={5}
                    autoFocus
                  />
                  <label className="diary-photo-picker">
                    <ImagePlus size={20} />
                    {photoName || (ko ? '사진 추가' : 'Add photo')}
                    <input
                      type="file"
                      name="photo"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label={ko ? '사진 추가' : 'Add photo'}
                      onChange={(event) =>
                        setPhotoName(event.target.files?.[0]?.name ?? '')
                      }
                    />
                  </label>
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
                        {label}
                        <span>{ko ? '선택' : 'Optional'}</span>
                        <input
                          type="number"
                          name={name}
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
                      name="private"
                      defaultChecked={record?.is_private ?? false}
                    />
                    {ko ? '비공개' : 'Private'}
                  </label>
                </fieldset>
                {error && <p role="alert">{error}</p>}
                {record && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={pending}
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
                  className="button primary"
                  disabled={pending}
                >
                  {pending
                    ? ko
                      ? '저장 중…'
                      : 'Saving…'
                    : ko
                      ? '저장'
                      : 'Save'}
                </button>
              </form>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
