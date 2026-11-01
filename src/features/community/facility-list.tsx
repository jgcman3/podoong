import { CloudSun, Thermometer, Droplets, CloudRain, Wind } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { CareContext } from '@/lib/data';
import { positiveMeasurement } from './public-data';
import {
  airObservations,
  hasPublicDataKey,
  weatherObservation,
} from './public-data.server';
import nursing from './data/nursing-rooms.json';
import type { CommunityQuery } from './hub';
import { FacilityNavigationForm } from './facility-navigation-form';
import { facilityKinds as kinds } from './facility-options';
import { loadFacilityRows } from './facility-listing.server';
import { FacilityFeed } from './facility-feed';
import Link from 'next/link';

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
  const medical = kind === 'hospital' || kind === 'pharmacy';
  const {
    facilities: rows,
    total,
    holiday,
    unavailable,
    checkedAt,
    asOf,
  } = await loadFacilityRows({
    kind,
    area,
    referenceArea,
    locale,
    page: 1,
    query,
  });
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
      {!area && kind !== 'nursing' ? (
        <p className="panel">
          {ko
            ? context.owner
              ? '주소 설정에 우리 동네를 등록해 주세요.'
              : '가족관리자가 주소를 등록하면 동네 시설을 볼 수 있어요.'
            : context.owner
              ? 'Add your area in address settings.'
              : 'Local facilities will appear after your family administrator adds an address.'}
          {context.owner && (
            <Link
              className="button secondary"
              href={`/${locale}/account?child=${context.child.id}&panel=residence`}
            >
              {ko ? '주소 설정' : 'Address settings'}
            </Link>
          )}
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
          <div className="facility-list-toolbar">
            <p className="small muted">
              {area || (ko ? '서울교통공사 전체' : 'Seoul Metro')} ·{' '}
              {ko
                ? `전체 ${total.toLocaleString()}곳`
                : `${total.toLocaleString()} facilities`}
            </p>
            {(medical || kind === 'nursing') && (
              <FacilityNavigationForm
                action={`/${locale}/facilities`}
                className="facility-filters"
                key={`${kind}-${query.open}-${query.diaper}-${query.place}`}
                autoSubmit
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
                      ? '현재 운영중인 곳만'
                      : 'Open now only'
                    : ko
                      ? '기저귀 교환대 있는 곳'
                      : 'With a changing table'}
                </label>
              </FacilityNavigationForm>
            )}
          </div>
          <FacilityFeed
            key={`${context.child.id}-${locale}-${kind}-${query.open}-${query.diaper}-${query.place}`}
            locale={locale}
            childId={context.child.id}
            kind={kind}
            place={query.place || ''}
            open={query.open === '1'}
            diaper={query.diaper === '1'}
            initialRows={rows}
            total={total}
            holiday={holiday}
            asOf={asOf}
          />
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
