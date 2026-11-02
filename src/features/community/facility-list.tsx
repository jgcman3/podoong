import { CloudSun, Thermometer, Droplets, CloudRain, Wind } from 'lucide-react';
import type { Locale } from '@/lib/domain';
import type { CareContext } from '@/lib/data';
import {
  airQuality,
  weatherCondition,
  positiveMeasurement,
} from './public-data';
import {
  airObservations,
  hasPublicDataKey,
  weatherObservation,
  weatherSky,
} from './public-data.server';
import { kidsCafeSources } from './kids-cafes';
import nursing from './data/nursing-rooms.json';
import type { CommunityQuery } from './hub';
import { FacilityNavigationForm } from './facility-navigation-form';
import { availableFacilityKinds } from './facility-availability.server';
import { loadFacilityRows } from './facility-listing.server';
import { FacilityFeed } from './facility-feed';
import Link from 'next/link';

export async function LocalConditions({
  area,
  locale,
}: {
  area: string;
  locale: Locale;
}) {
  const ko = locale === 'ko';
  if (!hasPublicDataKey() || !area) return null;
  const [weather, air, sky] = await Promise.all([
    weatherObservation(area).catch(() => null),
    airObservations(area.split(' ')[0]).catch(() => null),
    weatherSky(area).catch(() => undefined),
  ]);
  const localStation = area
    .split(' ')
    .reverse()
    .map((name) => air?.find((item) => item.station === name))
    .find(Boolean);
  const selected = localStation ?? air?.[0];
  const temperature = weather?.values.T1H,
    pm10 = positiveMeasurement(selected?.pm10),
    pm25 = positiveMeasurement(selected?.pm25);
  const validTemperature =
    temperature !== undefined &&
    Number.isFinite(Number(temperature)) &&
    Number(temperature) > -80 &&
    Number(temperature) < 60;
  const condition = weatherCondition(weather?.values.PTY, sky);
  const conditions = {
    clear: ['☀️', '맑음', 'Clear'],
    cloudy: ['⛅', '구름 많음', 'Partly cloudy'],
    overcast: ['☁️', '흐림', 'Overcast'],
    rain: ['🌧️', '비', 'Rain'],
    sleet: ['🌨️', '비·눈', 'Rain & snow'],
    snow: ['❄️', '눈', 'Snow'],
  } as const;
  const grades = {
    good: ['좋음', 'Good'],
    moderate: ['보통', 'Moderate'],
    bad: ['나쁨', 'Unhealthy'],
    'very-bad': ['매우 나쁨', 'Very unhealthy'],
  } as const;
  const pm10Grade = airQuality(pm10, 'pm10'),
    pm25Grade = airQuality(pm25, 'pm25');
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
            {condition ? (
              <span aria-hidden>{conditions[condition][0]}</span>
            ) : (
              <Thermometer size={23} aria-hidden />
            )}
          </span>
          <span className="weather-metric-label">
            {condition
              ? conditions[condition][ko ? 1 : 2]
              : ko
                ? '기온'
                : 'Temperature'}
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
          <small className={pm10Grade ? `air-quality ${pm10Grade}` : 'muted'}>
            {pm10Grade
              ? grades[pm10Grade][ko ? 0 : 1]
              : ko
                ? '관측 정보 없음'
                : 'No observation'}
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
          <small className={pm25Grade ? `air-quality ${pm25Grade}` : 'muted'}>
            {pm25Grade
              ? grades[pm25Grade][ko ? 0 : 1]
              : ko
                ? '관측 정보 없음'
                : 'No observation'}
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
  const kinds = availableFacilityKinds(area);
  const ko = locale === 'ko',
    kind = kinds.find(([id]) => id === query.kind)?.[0] ?? 'hospital';
  const medical = kind === 'hospital' || kind === 'pharmacy';
  const open = query.open !== '0';
  const specialty = query.specialty === 'all' ? 'all' : 'pediatrics';
  const hidden = {
    child: context.child.id,
    place: query.place ?? '',
    scope: query.scope ?? 'all',
    kind,
    specialty,
    open: query.open ?? '1',
  };
  const inputs = () =>
    Object.entries(hidden)
      .filter(
        ([name]) =>
          !(kind === 'hospital' && name === 'specialty') &&
          !(medical && name === 'open'),
      )
      .map(([name, value]) => (
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
                key={`${kind}-${query.open}-${query.diaper}-${query.place}-${specialty}`}
                autoSubmit
              >
                {inputs()}
                {kind === 'hospital' && (
                  <>
                    <input type="hidden" name="specialty" value="all" />
                    <label>
                      <input
                        type="checkbox"
                        name="specialty"
                        value="pediatrics"
                        defaultChecked={specialty === 'pediatrics'}
                      />
                      {ko ? '소아청소년과' : 'Pediatrics'}
                    </label>
                  </>
                )}
                {medical && <input type="hidden" name="open" value="0" />}
                <label>
                  <input
                    type="checkbox"
                    name={medical ? 'open' : 'diaper'}
                    value="1"
                    defaultChecked={medical ? open : query.diaper === '1'}
                  />
                  {medical
                    ? ko
                      ? '현재 운영중'
                      : 'Open now only'
                    : ko
                      ? '기저귀 교환대'
                      : 'With a changing table'}
                </label>
              </FacilityNavigationForm>
            )}
          </div>
          <FacilityFeed
            key={`${context.child.id}-${locale}-${kind}-${query.open}-${query.diaper}-${query.place}-${specialty}`}
            locale={locale}
            childId={context.child.id}
            kind={kind}
            place={query.place || ''}
            specialty={specialty}
            open={open}
            diaper={query.diaper === '1'}
            initialRows={rows}
            total={total}
            holiday={holiday}
            asOf={asOf}
          />
          {!visible.length && (
            <p className="panel">
              {open && medical
                ? ko
                  ? '등록된 시간 기준으로 현재 운영 중인 시설이 없어요.'
                  : 'No facilities are currently within their posted opening hours.'
                : kind === 'hospital' && specialty === 'pediatrics'
                  ? ko
                    ? '소아청소년과 진료가 등록된 병원이 없어요.'
                    : 'No hospitals with registered pediatric services in this area.'
                  : kind === 'kids-cafe'
                    ? ko
                      ? '해당 지역에 등록된 키즈카페 자료가 없어요.'
                      : 'No kids café data is available for this area yet.'
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
            : kind === 'daycare'
              ? `${ko ? '출처: 어린이집정보공개포털' : 'Source: Childcare Information Portal'}${checkedAt ? ` · ${ko ? '조회' : 'Retrieved'} ${new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(checkedAt))}` : ''}`
              : kind === 'kindergarten'
                ? `${ko ? '출처: 유치원알리미 일반현황' : 'Source: Kindergarten Info basic information'}${checkedAt ? ` · ${ko ? '조회' : 'Retrieved'} ${new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(checkedAt))}` : ''}`
                : kind === 'kids-cafe'
                  ? kidsCafeSources(area).map((source) => (
                      <span className="facility-data-source" key={source.id}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {source.name}
                        </a>
                        {' · '}
                        {ko ? '자료 기준' : 'Dataset date'} {source.sourceDate}
                      </span>
                    ))
                  : ''}
      </p>
    </section>
  );
}
