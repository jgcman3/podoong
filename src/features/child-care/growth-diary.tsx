import Link from 'next/link';
import Image from 'next/image';
import { Heart, Sparkles } from 'lucide-react';
import type { Row } from '@/lib/db';
import type { Locale } from '@/lib/domain';
import { childCopy, kindLabel } from './copy';
export function GrowthDiaryEntry({
  record,
  photos,
  locale,
  childId,
  dateLabel,
}: {
  record: Row<'child_records'>;
  photos: string[];
  locale: Locale;
  childId: string;
  dateLabel: string;
}) {
  const t = childCopy(locale);
  const title = record.title || kindLabel(record.kind, locale);
  const first = photos[0];
  const measures = [
    [t.height, record.height_cm],
    [t.weight, record.weight_kg],
    [t.head, record.head_cm],
  ] as const;
  return (
    <article className="growth-diary">
      <Link
        className="growth-diary-page"
        href={`/${locale}/care/growth/${record.id}?child=${childId}`}
        aria-label={`${title} · ${dateLabel}`}
      >
        <div className="growth-diary-text">
          <div className="growth-diary-kind">
            <Heart size={13} aria-hidden="true" />
            {kindLabel(record.kind, locale)}
          </div>
          <time className="growth-diary-date" dateTime={record.occurred_at}>
            {dateLabel}
          </time>
          <h2>{title}</h2>
          {measures.some(([, value]) => value !== null) && (
            <dl className="growth-diary-measures">
              {measures
                .filter(([, value]) => value !== null)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          )}
          {record.note && <p className="growth-diary-note">{record.note}</p>}
          <span className="growth-diary-open">
            {locale === 'ko' ? '일기 펼쳐보기' : 'Open this page'}{' '}
            <span aria-hidden="true">↗</span>
          </span>
        </div>
        <figure className={`growth-diary-picture ${first ? 'has-photo' : ''}`}>
          <div className="growth-diary-frame">
            {first ? (
              <>
                <Image
                  src={`/api/care/photos/${first}`}
                  alt={record.title || t.photo}
                  width={360}
                  height={360}
                  unoptimized
                />
                {photos.length > 1 && (
                  <span className="growth-diary-photo-count">
                    +{photos.length - 1}
                  </span>
                )}
              </>
            ) : (
              <div className="growth-diary-no-photo">
                <Sparkles size={28} strokeWidth={1.4} aria-hidden="true" />
                <span>
                  {locale === 'ko' ? '글로 남긴 하루' : 'A day in words'}
                </span>
              </div>
            )}
          </div>
          <figcaption>
            {first
              ? locale === 'ko'
                ? `사진 ${photos.length}장`
                : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`
              : locale === 'ko'
                ? '작은 순간, 소중한 기록'
                : 'Little moments to keep'}
          </figcaption>
        </figure>
      </Link>
    </article>
  );
}
