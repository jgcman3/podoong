import { ExternalLink, MapPin, Phone } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import {
  mapLinks,
  openingStatus,
  readableHours,
  weekdayHours,
  distanceLabel,
  type Facility,
} from './public-data';

export function FacilityCard({
  facility,
  locale,
  holiday,
  medical = false,
  asOf,
}: {
  facility: Facility;
  locale: Locale;
  holiday: boolean | null;
  medical?: boolean;
  asOf: string;
}) {
  const ko = locale === 'ko',
    links = mapLinks(facility);
  const status = openingStatus(facility.hours, holiday, new Date(asOf)),
    hours = readableHours(facility.hours, holiday, new Date(asOf));
  return (
    <article className="panel facility-card">
      <div className="facility-card-heading">
        <strong>
          <MapPin size={16} aria-hidden />
          {facility.name}
        </strong>
        {medical && (
          <small className={`facility-status ${status}`}>
            {status === 'open'
              ? ko
                ? '운영 시간 내'
                : 'Within posted hours'
              : status === 'closed'
                ? ko
                  ? '운영 시간 종료'
                  : 'Posted hours ended'
                : status === 'before'
                  ? ko
                    ? '운영 시간 전'
                    : 'Before posted hours'
                  : ko
                    ? '시간 확인 필요'
                    : 'Confirm hours'}
          </small>
        )}
      </div>
      <p>{facility.address}</p>
      {facility.distanceKm !== undefined && (
        <p className="facility-distance">
          <MapPin size={13} aria-hidden />
          {distanceLabel(facility.distanceKm, ko)}
        </p>
      )}
      {medical && (
        <div className="facility-hours">
          <p>
            <strong>{ko ? '오늘 운영시간' : 'Today’s hours'}</strong>
            <span>
              {hours ||
                (holiday === null
                  ? ko
                    ? '오늘 시간 확인 필요'
                    : 'Today’s hours unavailable'
                  : ko
                    ? '오늘 시간 미제공'
                    : 'Hours not provided today')}
            </span>
          </p>
          <details>
            <summary
              aria-label={ko ? '요일별 시간 펼치기' : 'Weekly opening hours'}
            >
              {ko ? '요일별 시간' : 'Weekly hours'}
            </summary>
            <dl>
              {(ko
                ? [
                    '월요일',
                    '화요일',
                    '수요일',
                    '목요일',
                    '금요일',
                    '토요일',
                    '일요일',
                    '공휴일',
                  ]
                : [
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                    'Sunday',
                    'Public holidays',
                  ]
              ).map((label, i) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {weekdayHours(facility.hours, i + 1) ||
                      (ko ? '정보 없음' : 'Not provided')}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      )}
      {facility.detail &&
        (medical ? (
          <details className="facility-extra">
            <summary>{ko ? '진료과목' : 'Specialties'}</summary>
            <p className="muted">{facility.detail}</p>
          </details>
        ) : (
          <p className="muted">{facility.detail}</p>
        ))}
      {facility.visiting && (
        <details className="facility-extra">
          <summary>{ko ? '이용 안내' : 'Visit information'}</summary>
          {facility.visiting.addressDetail && (
            <p>{facility.visiting.addressDetail}</p>
          )}
          <dl>
            <div>
              <dt>{ko ? '운영일' : 'Open days'}</dt>
              <dd>{facility.visiting.openDays || '—'}</dd>
            </div>
            <div>
              <dt>{ko ? '휴관일' : 'Closed days'}</dt>
              <dd>{facility.visiting.closedDays || '—'}</dd>
            </div>
          </dl>
        </details>
      )}
      <div className="facility-card-links">
        {facility.phone && (
          <a href={`tel:${facility.phone.replace(/[^\d+]/g, '')}`}>
            <Phone size={14} aria-hidden />
            {facility.phone}
          </a>
        )}
        <a href={links.naver} target="_blank" rel="noreferrer">
          {ko ? '네이버 지도' : 'Naver Map'}
          <ExternalLink size={13} aria-hidden />
        </a>
        <a href={links.kakao} target="_blank" rel="noreferrer">
          {ko ? '카카오맵' : 'Kakao Map'}
          <ExternalLink size={13} aria-hidden />
        </a>
      </div>
    </article>
  );
}
