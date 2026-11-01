import { ExternalLink, MapPin, Phone, CloudSun } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { CareContext } from '@/lib/data';
import {
  mapLinks,
  openingStatus,
  positiveMeasurement,
  readableHours,
  type Facility,
} from './public-data';
import {
  airObservations,
  hasPublicDataKey,
  medicalResults,
  playgroundList,
  kindergartenList,
  weatherObservation,
} from './public-data.server';
import nursing from './data/nursing-rooms.json';
import type { CommunityQuery } from './hub';

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
                : ko
                  ? '시간 확인 필요'
                  : 'Confirm hours'}
          </small>
        )}
      </div>
      <p>{facility.address}</p>
      {hours && (
        <p>
          {ko ? '오늘 등록 시간' : 'Posted hours today'} · {hours}
        </p>
      )}
      {facility.detail && <p className="muted">{facility.detail}</p>}
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
  const selected = air?.find((item) => item.station === station) ?? air?.[0];
  const temperature = weather?.values.T1H,
    pm10 = positiveMeasurement(selected?.pm10),
    pm25 = positiveMeasurement(selected?.pm25);
  return (
    <section
      className="panel local-conditions"
      aria-label={ko ? '날씨·미세먼지' : 'Weather & air quality'}
    >
      <h2>
        <CloudSun size={18} aria-hidden />
        {ko ? '날씨·미세먼지' : 'Weather & air quality'}
      </h2>
      <div className="local-condition-columns">
        <div>
          <strong>
            {temperature !== undefined && Number.isFinite(Number(temperature))
              ? `${temperature}°C`
              : '—'}
          </strong>
          <p className="small muted">
            {weather
              ? `${weather.label} · ${weather.date.slice(4, 6)}.${weather.date.slice(6)} ${weather.time.slice(0, 2)}:00 KST`
              : ko
                ? '날씨 정보를 불러오지 못했어요.'
                : 'Weather is temporarily unavailable.'}
          </p>
          {weather && (
            <small>
              {ko ? '강수량' : 'Rain'} {weather.values.RN1 ?? '—'} mm ·{' '}
              {ko ? '습도' : 'Humidity'} {weather.values.REH ?? '—'}%
            </small>
          )}
        </div>
        <div>
          <strong>
            PM10 {pm10 ?? '—'} · PM2.5 {pm25 ?? '—'} <small>µg/m³</small>
          </strong>
          {air?.length ? (
            <form method="get" className="air-station-picker">
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
            </form>
          ) : (
            <p className="small muted">
              {ko
                ? '미세먼지 정보를 불러오지 못했어요.'
                : 'Air quality is temporarily unavailable.'}
            </p>
          )}
          {selected && (
            <p className="small muted">
              {selected.station} · {selected.time} KST
            </p>
          )}
        </div>
      </div>
      <p className="small muted">
        {ko
          ? '출처: 기상청 초단기실황 · 에어코리아. 선택한 지역의 격자·측정소 관측값이에요.'
          : 'Source: KMA observations · AirKorea. Measurements refer to the displayed grid and station.'}
      </p>
    </section>
  );
}

export async function FacilityList({
  context,
  area,
  locale,
  query,
}: {
  context: CareContext;
  area: string;
  locale: Locale;
  query: CommunityQuery;
}) {
  const ko = locale === 'ko',
    kind = kinds.find(([id]) => id === query.kind)?.[0] ?? 'hospital';
  const page = Math.min(
    1000,
    Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1),
  );
  const hidden = {
    child: context.child.id,
    place: query.place ?? '',
    scope: query.scope ?? 'all',
    kind,
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
      const result = await medicalResults(kind, area, page);
      rows = result.facilities;
      total = result.total;
      holiday = result.holiday;
      checkedAt = result.checkedAt;
    } catch {
      unavailable = true;
    }
  } else if (kind === 'playground' && area) {
    try {
      const facilities = await playgroundList(area);
      total = facilities.length;
      rows = facilities.slice((page - 1) * 10, page * 10);
    } catch {
      unavailable = true;
    }
  } else if (kind === 'kindergarten' && area) {
    try {
      const result = await kindergartenList(area);
      total = result.facilities.length;
      rows = result.facilities.slice((page - 1) * 10, page * 10);
      checkedAt = result.checkedAt;
    } catch {
      unavailable = true;
    }
  }
  const visible =
    query.open === '1' && medical
      ? rows.filter((row) => openingStatus(row.hours, holiday) === 'open')
      : rows;
  return (
    <section className="facility-browser">
      <form
        method="get"
        className="community-pills facility-kinds"
        aria-label={ko ? '시설 종류' : 'Facility type'}
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
      </form>
      {(medical || kind === 'nursing') && (
        <form method="get" className="facility-filters">
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
        </form>
      )}
      {medical && (
        <p className="small muted">
          {ko
            ? '등록된 운영시간과 공휴일 기준이며 실시간 진료 여부와 다를 수 있어요. 방문 전 전화로 확인해 주세요. 필터는 현재 페이지의 시설에 적용돼요.'
            : 'Based on posted hours and Korean holidays, not live availability. Call before visiting. The filter applies to this page.'}
        </p>
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
                  ? '이 페이지에서 운영시간을 확인할 수 있는 시설이 없어요. 다음 목록도 확인해 주세요.'
                  : 'No facilities with confirmed opening hours on this page. Try the next page.'
                : ko
                  ? '해당 지역에 수집된 시설이 없어요.'
                  : 'No collected facilities in this area.'}
            </p>
          )}
          {kind !== 'nursing' && (
            <form method="get" className="facility-pagination">
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
            </form>
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
