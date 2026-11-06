'use client';
import './posts.css';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Folder,
  ImagePlus,
  ListChecks,
  Plus,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import { publishParentingPost, deleteParentingPost } from './post-action';
import { prepareCommunityPhoto } from './prepare-photo';
import { samePhoto } from './photo-equality';
import {
  MAX_POST_PHOTOS,
  pollInputSchema,
  type PostDetail,
} from './post-model';
type Attachment = { file?: File; url: string; id: string };
export function PostComposer({
  child,
  locale,
  tags,
  initialTag,
  source,
  edit,
  onSaved,
  autoOpen = false,
}: {
  child: string;
  locale: Locale;
  tags: readonly (readonly [string, string, string])[];
  initialTag: string;
  source: 'neighborhood';
  edit?: PostDetail;
  onSaved?: (post: PostDetail) => void;
  autoOpen?: boolean;
}) {
  const ko = locale === 'ko',
    router = useRouter(),
    formId = useId(),
    menu = useRef<HTMLDetailsElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    titleInput = useRef<HTMLInputElement>(null),
    picker = useRef<HTMLInputElement>(null),
    attachments = useRef<Attachment[]>(
      (edit?.photos ?? []).map((id) => ({
        id,
        url: `/api/community/post-photos/${id}?size=480`,
      })),
    ),
    converting = useRef(false),
    submitting = useRef(false),
    mounted = useRef(true);
  const [title, setTitle] = useState(edit?.title ?? ''),
    [body, setBody] = useState(edit?.body ?? ''),
    [tag, setTag] = useState(
      tags.some(([id]) => id === initialTag) ? initialTag : '',
    ),
    [photos, setPhotos] = useState<Attachment[]>(
      (edit?.photos ?? []).map((id) => ({
        id,
        url: `/api/community/post-photos/${id}?size=480`,
      })),
    ),
    [saving, setSaving] = useState(false),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState(''),
    [pollOpen, setPollOpen] = useState(!!edit?.poll),
    [pollQuestion, setPollQuestion] = useState(edit?.poll?.question ?? ''),
    [pollOptions, setPollOptions] = useState(edit?.poll?.options ?? ['', '']);
  const frozenPoll = !!edit?.poll?.total;
  const poll = pollInputSchema.safeParse({
    question: pollQuestion,
    options: pollOptions,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      attachments.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);
  useEffect(() => {
    if (autoOpen) {
      dialog.current?.showModal();
      titleInput.current?.focus();
    }
  }, [autoOpen]);
  function open() {
    if (menu.current) menu.current.open = false;
    dialog.current?.showModal();
    titleInput.current?.focus();
  }
  function remove(id: string) {
    const item = attachments.current.find((photo) => photo.id === id);
    if (item) URL.revokeObjectURL(item.url);
    attachments.current = attachments.current.filter(
      (photo) => photo.id !== id,
    );
    setPhotos(attachments.current);
  }
  async function add(files: File[]) {
    if (!files.length || converting.current) return;
    converting.current = true;
    setPreparing(true);
    setError('');
    let failed = 0;
    try {
      // Process one at a time to keep phone memory usage bounded.
      for (const original of files) {
        try {
          const file = await prepareCommunityPhoto(original);
          if (!mounted.current) return;
          let duplicate = false;
          for (const current of attachments.current) {
            if (current.file && (await samePhoto(current.file, file))) {
              duplicate = true;
              break;
            }
          }
          if (duplicate) continue;
          if (attachments.current.length >= MAX_POST_PHOTOS) {
            setError(
              ko
                ? '사진은 최대 9장까지 첨부할 수 있어요.'
                : 'You can attach up to 9 photos.',
            );
            break;
          }

          const url = URL.createObjectURL(file);
          attachments.current = [
            ...attachments.current,
            { file, url, id: url },
          ];
          setPhotos(attachments.current);
        } catch {
          failed++;
        }
      }
      if (failed && mounted.current)
        setError(
          ko
            ? '일부 사진을 불러오지 못했어요. 해당 사진을 다시 선택해 주세요.'
            : 'Some photos could not be opened. Please select them again.',
        );
    } finally {
      converting.current = false;
      if (mounted.current) setPreparing(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || converting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    if (pollOpen) {
      if (!poll.success) {
        setSaving(false);
        submitting.current = false;
        return;
      }
      form.set('poll', JSON.stringify(poll.data));
    }
    photos.forEach((photo) => {
      if (photo.file) form.append('photo', photo.file);
    });
    form.set(
      'keepPhotos',
      JSON.stringify(
        photos.filter((photo) => !photo.file).map((photo) => photo.id),
      ),
    );
    try {
      const result = await publishParentingPost(form);
      if (!result.saved) {
        setError(
          ko
            ? '등록하지 못했어요. 내용을 유지했으니 다시 시도해 주세요.'
            : 'Could not publish. Your draft is kept; please try again.',
        );
        return;
      }
      if (result.post) onSaved?.(result.post);
      attachments.current.forEach((photo) => {
        if (photo.file) URL.revokeObjectURL(photo.url);
      });
      attachments.current = [];
      setPhotos([]);
      setTitle('');
      setBody('');
      setPollOpen(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      dialog.current?.close();
      if (!edit) router.refresh();
    } catch {
      setError(
        ko
          ? '등록하지 못했어요. 다시 시도해 주세요.'
          : 'Could not publish. Please try again.',
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <>
      {edit ? (
        <details ref={menu} className="parenting-own-menu">
          <summary aria-label={ko ? '내 글 관리' : 'Manage my post'}>
            <MoreHorizontal size={24} />
          </summary>
          <div>
            <button type="button" onClick={open}>
              <Pencil size={15} />
              {ko ? '편집' : 'Edit'}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (
                  !window.confirm(
                    ko
                      ? '이 글을 삭제할까요? 댓글과 첨부 사진도 함께 삭제됩니다.'
                      : 'Delete this post, its comments and photos?',
                  )
                )
                  return;
                setSaving(true);
                setError('');
                try {
                  if (await deleteParentingPost({ post: edit.id, locale }))
                    router.replace(
                      `/${locale}/community/${source}?child=${child}`,
                    );
                  else throw Error();
                } catch {
                  setError(
                    ko
                      ? '삭제하지 못했어요. 다시 시도해 주세요.'
                      : 'Could not delete. Please try again.',
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Trash2 size={15} />
              {ko ? '삭제' : 'Delete'}
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        </details>
      ) : (
        <button type="button" className="community-write-fab" onClick={open}>
          <Plus size={20} />
          {ko ? '글쓰기' : 'Write'}
        </button>
      )}
      <dialog
        ref={dialog}
        className="community-editor"
        aria-label={
          edit ? (ko ? '글 편집' : 'Edit post') : ko ? '글쓰기' : 'Write a post'
        }
        onCancel={(event) => {
          if (saving || preparing) event.preventDefault();
        }}
      >
        <header className="community-editor-header">
          <button
            type="button"
            aria-label={ko ? '닫기' : 'Close'}
            disabled={saving || preparing}
            onClick={() => dialog.current?.close()}
          >
            <X size={23} />
          </button>
          <h2>
            {edit
              ? ko
                ? '글 편집'
                : 'Edit post'
              : ko
                ? '글쓰기'
                : 'Write a post'}
          </h2>
          <button
            type="submit"
            form={formId}
            className="community-publish"
            disabled={
              saving ||
              preparing ||
              !title.trim() ||
              !body.trim() ||
              !tag ||
              (pollOpen && !poll.success)
            }
          >
            {saving ? (ko ? '등록 중…' : 'Posting…') : ko ? '완료' : 'Post'}
          </button>
        </header>
        <form id={formId} onSubmit={submit} className="community-editor-form">
          <input type="hidden" name="child" value={child} />
          <input type="hidden" name="locale" value={locale} />
          {edit && <input type="hidden" name="post" value={edit.id} />}
          <div className="community-editor-content">
            <label className="community-editor-tag">
              <Folder size={17} />
              <select
                name="category"
                aria-label={ko ? '카테고리' : 'Category'}
                required
                disabled={saving || preparing}
                value={tag}
                onChange={(event) => setTag(event.target.value)}
              >
                <option value="" disabled>
                  {ko ? '카테고리를 선택해 주세요' : 'Choose a category'}
                </option>
                {tags.map(([id, k, e]) => (
                  <option key={id} value={id}>
                    {ko ? k : e}
                  </option>
                ))}
              </select>
            </label>
            <input
              ref={titleInput}
              className="community-title-input"
              name="title"
              aria-label={ko ? '제목' : 'Title'}
              placeholder={ko ? '제목을 입력해 주세요.' : 'Add a title'}
              maxLength={100}
              required
              readOnly={saving}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              className="community-body-input"
              name="body"
              aria-label={ko ? '내용' : 'Content'}
              placeholder={
                ko
                  ? '육아 이야기를 나눠보세요. #태그도 직접 적을 수 있어요.'
                  : 'Share your parenting day. Add #tags in your text.'
              }
              maxLength={3000}
              required
              readOnly={saving}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            {pollOpen && (
              <section
                className="community-poll-editor"
                aria-label={ko ? '투표 첨부' : 'Attach a poll'}
              >
                <header>
                  <strong>{ko ? '투표' : 'Poll'}</strong>
                  <button
                    type="button"
                    aria-label={ko ? '투표 제거' : 'Remove poll'}
                    disabled={saving || frozenPoll}
                    onClick={() => setPollOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </header>
                <input
                  aria-label={ko ? '투표 질문' : 'Poll question'}
                  placeholder={
                    ko ? '무엇이 궁금한가요?' : 'What would you like to ask?'
                  }
                  value={pollQuestion}
                  maxLength={150}
                  disabled={saving || frozenPoll}
                  onChange={(event) => setPollQuestion(event.target.value)}
                />
                {pollOptions.map((option, index) => (
                  <div className="community-poll-option-editor" key={index}>
                    <input
                      aria-label={
                        ko ? `선택지 ${index + 1}` : `Option ${index + 1}`
                      }
                      placeholder={
                        ko ? `선택지 ${index + 1}` : `Option ${index + 1}`
                      }
                      value={option}
                      maxLength={80}
                      disabled={saving || frozenPoll}
                      onChange={(event) =>
                        setPollOptions((options) =>
                          options.map((value, i) =>
                            i === index ? event.target.value : value,
                          ),
                        )
                      }
                    />
                    {!frozenPoll && pollOptions.length > 2 && (
                      <button
                        type="button"
                        aria-label={
                          ko
                            ? `${index + 1}번 선택지 제거`
                            : `Remove option ${index + 1}`
                        }
                        disabled={saving}
                        onClick={() =>
                          setPollOptions((options) =>
                            options.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {!frozenPoll && pollOptions.length < 6 && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setPollOptions((options) => [...options, ''])
                    }
                  >
                    <Plus size={15} />
                    {ko ? '선택지 추가' : 'Add option'}
                  </button>
                )}
              </section>
            )}
            {!!photos.length && (
              <div className="community-photo-previews">
                {photos.map((photo, index) => (
                  <div key={photo.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={
                        ko
                          ? `첨부 사진 ${index + 1}`
                          : `Attachment ${index + 1}`
                      }
                    />
                    <button
                      type="button"
                      aria-label={
                        ko
                          ? `${index + 1}번 사진 제거`
                          : `Remove photo ${index + 1}`
                      }
                      onClick={() => remove(photo.id)}
                      disabled={saving || preparing}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && (
              <p className="community-compose-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="community-editor-toolbar">
            <button
              type="button"
              onClick={() => picker.current?.click()}
              aria-label={ko ? '이미지 첨부' : 'Attach images'}
              disabled={
                saving || preparing || photos.length === MAX_POST_PHOTOS
              }
            >
              <ImagePlus size={23} />
              <span aria-live="polite">
                {preparing
                  ? ko
                    ? '사진 준비 중…'
                    : 'Preparing photos…'
                  : `${photos.length}/${MAX_POST_PHOTOS}`}
              </span>
            </button>
            <button
              type="button"
              aria-label={ko ? '투표 첨부' : 'Attach a poll'}
              aria-pressed={pollOpen}
              disabled={saving || preparing || frozenPoll}
              onClick={() => setPollOpen((value) => !value)}
            >
              <ListChecks size={24} />
            </button>
            <input
              ref={picker}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              hidden
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = '';
                void add(files);
              }}
              aria-label={ko ? '첨부 이미지' : 'Images'}
            />
          </footer>
        </form>
      </dialog>
    </>
  );
}
