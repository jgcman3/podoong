import {
  ExternalLink,
  MapPin,
  Phone,
  CloudSun,
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
} from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { CareContext } from '@/lib/data';
import {
  mapLinks,
  openingStatus,
  positiveMeasurement,
  readableHours,
  weekdayHours,
  distanceLabel,
  nearbyFacilities,
  type Facility,
} from './public-data';
import {
  airObservations,
  hasPublicDataKey,
  medicalResults,
  playgroundList,
  kindergartenList,
  weatherObservation,
  facilityOrigin,
  areaPointChoices,
} from './public-data.server';
import nursing from './data/nursing-rooms.json';
import type { CommunityQuery } from './hub';
import { FacilityNavigationForm } from './facility-navigation-form';

const kinds = [
  ['hospital', '병원', 'Hospitals'],
  ['pharmacy', '약국', 'Pharmacies'],
  ['daycare', '어린이집', 'Daycare'],
  ['kindergarten', '유치원', 'Kindergartens'],
  ['playground', '놀이터·놀이시설', 'Playgrounds'],
  ['nursing', '수유실·기저귀 교환대', 'Nursing & changing'],
] as const;

function FacilityCard({
  facility,
  locale,
  holiday,
  medical = false,
}: {
  facility: Facility;
  locale: Locale;
  holiday: boolean | null;
  medical?: boolean;
}) {
  const ko = locale === 'ko',
    links = mapLinks(facility);
  const status = openingStatus(facility.hours, holiday),
    hours = readableHours(facility.hours, holiday);
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

export async function LocalConditions({
  area,
  locale,
  station,
  hidden,
}: {
  area: string;
  locale: Locale;
  station?: string;
  hidden: Record<string, string>;
}) {
  const ko = locale === 'ko';
  if (!hasPublicDataKey() || !area) return null;
  const [weather, air] = await Promise.all([
    weatherObservation(area).catch(() => null),
    airObservations(area.split(' ')[0]).catch(() => null),
  ]);
  const localStation = area
    .split(' ')
    .reverse()
    .map((name) => air?.find((item) => item.station === name))
    .find(Boolean);
  const selected =
    air?.find((item) => item.station === station) ?? localStation ?? air?.[0];
  const temperature = weather?.values.T1H,
    pm10 = positiveMeasurement(selected?.pm10),
    pm25 = positiveMeasurement(selected?.pm25);
  const validTemperature =
    temperature !== undefined &&
    Number.isFinite(Number(temperature)) &&
    Number(temperature) > -80 &&
    Number(temperature) < 60;
  return (
    <section
      className="panel local-conditions weather-overview"
      aria-label={ko ? '날씨·미세먼지' : 'Weather & air quality'}
    >
      <header>
        <h2>
          <CloudSun size={20} aria-hidden />
          {ko ? '우리 동네 날씨' : 'Local weather'}
        </h2>
        <span className="small muted">{area}</span>
      </header>
      <div className="weather-metrics">
        <div className="weather-metric temperature">
          <span className="weather-symbol">
            <Thermometer size={23} aria-hidden />
          </span>
          <span className="weather-metric-label">
            {ko ? '기온' : 'Temperature'}
          </span>
          <strong>
            {validTemperature ? temperature : '—'}
            {validTemperature && <small>°C</small>}
          </strong>
          <small className="muted">
            {weather
              ? `${weather.date.slice(4, 6)}.${weather.date.slice(6)} ${weather.time.slice(0, 2)}:00`
              : ko
                ? '관측 정보 없음'
                : 'No observation'}
          </small>
        </div>
        <div className="weather-metric pm10">
          <span className="weather-symbol">
            <Wind size={23} aria-hidden />
          </span>
          <span className="weather-metric-label">
            {ko ? '미세먼지' : 'Fine dust'}
          </span>
          <strong>
            {pm10 ?? '—'}
            {pm10 !== null && <small>µg/m³</small>}
          </strong>
          <small className="muted">
            {pm10 !== null ? 'PM10' : ko ? '관측 정보 없음' : 'No observation'}
          </small>
        </div>
        <div className="weather-metric pm25">
          <span className="weather-symbol">
            <Wind size={23} aria-hidden />
          </span>
          <span className="weather-metric-label">
            {ko ? '초미세먼지' : 'Ultrafine dust'}
          </span>
          <strong>
            {pm25 ?? '—'}
            {pm25 !== null && <small>µg/m³</small>}
          </strong>
          <small className="muted">
            {pm25 !== null ? 'PM2.5' : ko ? '관측 정보 없음' : 'No observation'}
          </small>
        </div>
      </div>
      {weather && (
        <div className="weather-extras">
          <span>
            <Droplets size={15} aria-hidden />
            {ko ? '습도' : 'Humidity'} {weather.values.REH ?? '—'}%
          </span>
          <span>
            <CloudRain size={15} aria-hidden />
            {ko ? '강수량' : 'Rain'} {weather.values.RN1 ?? '—'} mm
          </span>
        </div>
      )}
      {selected && (
        <p className="weather-source small muted">
          {selected.station} · {selected.time} KST
        </p>
      )}
      {air?.length ? (
        <details className="weather-station">
          <summary>{ko ? '측정소 변경' : 'Change air station'}</summary>
          <FacilityNavigationForm
            action={`/${locale}/facilities`}
            className="air-station-picker"
          >
            {Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <label>
              <span className="small">
                {ko ? '시·도 내 측정소' : 'Station in this province'}
              </span>
              <select
                name="station"
                defaultValue={selected?.station}
                aria-label={ko ? '미세먼지 측정소' : 'Air quality station'}
              >
                {air.map((item) => (
                  <option key={item.station} value={item.station}>
                    {item.station}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" type="submit">
              {ko ? '보기' : 'View'}
            </button>
          </FacilityNavigationForm>
        </details>
      ) : null}
      <p className="weather-source small muted">
        {weather
          ? `${ko ? '기상청' : 'KMA'} (${weather.label}) · ${ko ? '에어코리아' : 'AirKorea'}`
          : ko
            ? '기상청 · 에어코리아'
            : 'KMA · AirKorea'}
      </p>
    </section>
  );
}

export async function FacilityList({
  context,
  area,
  locale,
  query,
  referenceArea,
}: {
  context: CareContext;
  area: string;
  locale: Locale;
  query: CommunityQuery;
  referenceArea?: string;
}) {
  const ko = locale === 'ko',
    kind = kinds.find(([id]) => id === query.kind)?.[0] ?? 'hospital';
  const page = Math.min(
    1000,
    Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1),
  );
  const pointChoices = areaPointChoices(area);
  const anchor =
    query.anchor && pointChoices.includes(query.anchor) ? query.anchor : '';
  const hidden = {
    child: context.child.id,
    place: query.place ?? '',
    scope: query.scope ?? 'all',
    kind,
    anchor,
  };
  const inputs = () =>
    Object.entries(hidden).map(([name, value]) => (
      <input key={name} type="hidden" name={name} value={value} />
    ));
  if ((context.family.residence_country_code ?? 'KR') !== 'KR')
    return (
      <p className="panel">
        {ko
          ? '시설 정보는 현재 한국 지역에서 제공해요.'
          : 'Facility data currently covers South Korea.'}
      </p>
    );
  let rows: Facility[] = [],
    total = 0,
    holiday: boolean | null = null,
    unavailable = false,
    checkedAt = '';
  const medical = kind === 'hospital' || kind === 'pharmacy';
  const origin =
    kind !== 'nursing' && area
      ? await facilityOrigin(anchor || referenceArea || area)
      : undefined;
  if (kind === 'nursing') {
    rows = nursing.rooms
      .filter((room) => !area || room.address.startsWith(area))
      .filter((room) => query.diaper !== '1' || room.diaperTable)
      .map((room) => ({
        id: room.id,
        name: room.name,
        address: room.address,
        phone: '',
        hours: {},
        diaperTable: room.diaperTable,
        detail: [
          room.location,
          room.kind,
          room.fareArea,
          room.viaOffice === '고객안전실경유'
            ? ko
              ? '고객안전실 경유'
              : 'Via station office'
            : '',
          room.diaperTable
            ? ko
              ? '기저귀 교환대 있음'
              : 'Changing table available'
            : '',
        ]
          .filter(Boolean)
          .join(' · '),
      }));
    total = rows.length;
  } else if (medical && area) {
    try {
      const result = await medicalResults(kind, area, page, {
        origin: origin?.coordinates,
        openOnly: query.open === '1',
      });
      rows = result.facilities;
      total = result.total;
      holiday = result.holiday;
      checkedAt = result.checkedAt;
    } catch {
      unavailable = true;
    }
  } else if (kind === 'playground' && area) {
    try {
      const facilities = nearbyFacilities(
        await playgroundList(area),
        origin?.coordinates,
      );
      total = facilities.length;
      rows = facilities.slice((page - 1) * 10, page * 10);
    } catch {
      unavailable = true;
    }
  } else if (kind === 'kindergarten' && area) {
    try {
      const result = await kindergartenList(area);
      const ranked = nearbyFacilities(result.facilities, origin?.coordinates);
      total = ranked.length;
      rows = ranked.slice((page - 1) * 10, page * 10);
      checkedAt = result.checkedAt;
    } catch {
      unavailable = true;
    }
  }
  const visible = rows;
  return (
    <section className="facility-browser">
      <FacilityNavigationForm
        action={`/${locale}/facilities`}
        className="community-pills facility-kinds"
        label={ko ? '시설 종류' : 'Facility type'}
      >
        {Object.entries(hidden)
          .filter(([name]) => name !== 'kind')
          .map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        {kinds.map(([id, k, e]) => (
          <button
            key={id}
            type="submit"
            name="kind"
            value={id}
            aria-pressed={kind === id}
          >
            {ko ? k : e}
          </button>
        ))}
      </FacilityNavigationForm>
      {origin && (
        <details className="facility-distance-reference small muted">
          <summary>
            {ko
              ? `${origin.label} 기준 · 가까운 순`
              : `Nearest to ${origin.label}`}
          </summary>
          <p>
            {ko
              ? '선택한 지역 기준점으로부터의 대략적인 직선거리예요.'
              : 'Approximate straight-line distance from the selected area reference point.'}
          </p>
          <FacilityNavigationForm
            action={`/${locale}/facilities`}
            className="air-station-picker"
          >
            {Object.entries(hidden)
              .filter(([name]) => name !== 'anchor')
              .map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
            <label>
              {ko ? '거리 기준' : 'Distance reference'}
              <select name="anchor" defaultValue={anchor || ''}>
                <option value="">
                  {ko ? '등록한 동네 기준' : 'Registered area'}
                </option>
                {pointChoices.map((name) => (
                  <option key={name} value={name}>
                    {name.slice(area.length).trim() || name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button secondary" type="submit">
              {ko ? '적용' : 'Apply'}
            </button>
          </FacilityNavigationForm>
        </details>
      )}
      {(medical || kind === 'nursing') && (
        <FacilityNavigationForm
          action={`/${locale}/facilities`}
          className="facility-filters"
        >
          {inputs()}
          <label>
            <input
              type="checkbox"
              name={medical ? 'open' : 'diaper'}
              value="1"
              defaultChecked={
                medical ? query.open === '1' : query.diaper === '1'
              }
            />
            {medical
              ? ko
                ? '운영 시간 내인 곳만'
                : 'Within posted hours only'
              : ko
                ? '기저귀 교환대 있는 곳'
                : 'With a changing table'}
          </label>
          <button className="button secondary" type="submit">
            {ko ? '적용' : 'Apply'}
          </button>
        </FacilityNavigationForm>
      )}
      {!area && kind !== 'nursing' ? (
        <p className="panel">
          {ko
            ? '시·군·구를 선택하면 시설을 볼 수 있어요.'
            : 'Choose a district to see facilities.'}
        </p>
      ) : unavailable ? (
        <p className="panel" role="status">
          {ko
            ? '시설 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.'
            : 'Facility information is temporarily unavailable. Please try again.'}
        </p>
      ) : kind === 'daycare' ? (
        <p className="panel">
          {ko
            ? '공식 시설 정보 연결을 준비하고 있어요.'
            : 'The official facility data connection is being prepared.'}
        </p>
      ) : (
        <>
          <p className="small muted">
            {area || (ko ? '서울교통공사 전체' : 'Seoul Metro')} ·{' '}
            {ko
              ? `전체 ${total.toLocaleString()}곳`
              : `${total.toLocaleString()} facilities`}
            {medical ? ` · ${ko ? `${page}페이지` : `Page ${page}`}` : ''}
          </p>
          <div className="facility-list">
            {visible.map((facility) => (
              <FacilityCard
                key={facility.id}
                facility={facility}
                locale={locale}
                holiday={holiday}
                medical={medical}
              />
            ))}
          </div>
          {!visible.length && (
            <p className="panel">
              {query.open === '1' && medical
                ? ko
                  ? '등록된 시간 기준으로 현재 운영 중인 시설이 없어요.'
                  : 'No facilities are currently within their posted opening hours.'
                : ko
                  ? '해당 지역에 수집된 시설이 없어요.'
                  : 'No collected facilities in this area.'}
            </p>
          )}
          {kind !== 'nursing' && (
            <FacilityNavigationForm
              action={`/${locale}/facilities`}
              className="facility-pagination"
            >
              {inputs()}
              {query.open === '1' && (
                <input type="hidden" name="open" value="1" />
              )}
              {page > 1 && (
                <button
                  className="button secondary"
                  name="page"
                  value={page - 1}
                >
                  {ko ? '이전' : 'Previous'}
                </button>
              )}
              {page * 10 < total && (
                <button
                  className="button secondary"
                  name="page"
                  value={page + 1}
                >
                  {ko ? '다음 시설' : 'Next facilities'}
                </button>
              )}
            </FacilityNavigationForm>
          )}
        </>
      )}
      <p className="small muted">
        {kind === 'nursing'
          ? `${ko ? '출처: 서울교통공사 수유실현황 · 자료 기준' : 'Source: Seoul Metro nursing rooms · Dataset date'} ${nursing.sourceDate}`
          : medical
            ? `${ko ? '출처: 국립중앙의료원' : 'Source: National Emergency Medical Center'}${checkedAt ? ` · ${ko ? '조회' : 'Retrieved'} ${new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(checkedAt))}` : ''}`
            : kind === 'kindergarten'
              ? `${ko ? '출처: 유치원알리미 일반현황' : 'Source: Kindergarten Info basic information'}${checkedAt ? ` · ${ko ? '조회' : 'Retrieved'} ${new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(checkedAt))}` : ''}`
              : kind === 'playground'
                ? ko
                  ? '출처: 행정안전부 어린이놀이시설 안전관리시스템 · 사유 시설은 이용 가능 여부를 확인해 주세요.'
                  : 'Source: MOIS playground safety system · Confirm access to privately operated facilities.'
                : ''}
      </p>
    </section>
  );
}
