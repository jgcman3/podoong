'use client';
import { useEffect, useRef, useState } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';
import type { Locale } from '@/lib/domain';

type Place = {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  phone: string;
  place_url: string;
  x: string;
  y: string;
};
type MapInstance = {
  setCenter(p: unknown): void;
  getCenter(): unknown;
  setBounds(b: unknown): void;
};
type Kakao = {
  maps: {
    load(fn: () => void): void;
    LatLng: new (lat: number, lng: number) => unknown;
    LatLngBounds: new () => { extend(p: unknown): void };
    Map: new (el: HTMLElement, options: object) => MapInstance;
    Marker: new (options: object) => { setMap(map: MapInstance | null): void };
    event: {
      addListener(target: unknown, event: string, fn: () => void): void;
      removeListener(target: unknown, event: string, fn: () => void): void;
    };
    services: {
      Status: { OK: string; ZERO_RESULT: string };
      Geocoder: new () => {
        addressSearch(
          query: string,
          cb: (results: { x: string; y: string }[], status: string) => void,
        ): void;
      };
      Places: new (map: MapInstance) => {
        categorySearch(
          category: string,
          cb: (
            results: Place[],
            status: string,
            pagination: { hasNextPage: boolean; nextPage(): void },
          ) => void,
          options: object,
        ): void;
      };
    };
  };
};
declare global {
  interface Window {
    kakao?: Kakao;
  }
}
let sdkPromise: Promise<Kakao> | undefined;
function loadSdk(key: string) {
  if (!sdkPromise)
    sdkPromise = new Promise<Kakao>((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => {
        script.remove();
        reject(new Error('map-timeout'));
      }, 15000);
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
      script.onload = () => {
        if (!window.kakao) {
          window.clearTimeout(timeout);
          reject(new Error('map-unavailable'));
          return;
        }
        window.kakao.maps.load(() => {
          window.clearTimeout(timeout);
          resolve(window.kakao!);
        });
      };
      script.onerror = () => {
        window.clearTimeout(timeout);
        script.remove();
        reject(new Error('map-unavailable'));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      sdkPromise = undefined;
      throw error;
    });
  return sdkPromise;
}
const kinds = [
  ['PS3', '어린이집·유치원', 'Daycare'],
  ['HP8', '병원', 'Hospitals'],
  ['PM9', '약국', 'Pharmacies'],
] as const;
export function FacilityMap({
  area,
  country,
  locale,
}: {
  area: string;
  country: string | null;
  locale: Locale;
}) {
  const ko = locale === 'ko';
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const ref = useRef<HTMLDivElement>(null);
  const search = useRef<(() => void) | null>(null);
  const next = useRef<(() => void) | null>(null);
  const [kind, setKind] = useState('PS3');
  const [retry, setRetry] = useState(0);
  const [places, setPlaces] = useState<Place[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading',
  );
  const [hasNext, setHasNext] = useState(false);
  useEffect(() => {
    if (!key || !ref.current || country !== 'KR' || !area) return;
    let disposed = false;
    let markers: { setMap(map: MapInstance | null): void }[] = [];
    setState('loading');
    setPlaces([]);
    setHasNext(false);
    loadSdk(key)
      .then((kakao) => {
        if (disposed || !ref.current) return;
        const maps = kakao.maps;
        new maps.services.Geocoder().addressSearch(
          area,
          (locations, status) => {
            if (disposed) return;
            if (status !== maps.services.Status.OK || !locations[0]) {
              setState('error');
              return;
            }
            const map = new maps.Map(ref.current!, {
              center: new maps.LatLng(
                Number(locations[0].y),
                Number(locations[0].x),
              ),
              level: 5,
            });
            const service = new maps.services.Places(map);
            search.current = () => {
              if (disposed) return;
              setState('loading');
              service.categorySearch(
                kind,
                (results, status, pagination) => {
                  if (disposed) return;
                  markers.forEach((marker) => marker.setMap(null));
                  markers = [];
                  if (status !== maps.services.Status.OK) {
                    setPlaces([]);
                    setHasNext(false);
                    setState(
                      status === maps.services.Status.ZERO_RESULT
                        ? 'empty'
                        : 'error',
                    );
                    return;
                  }
                  setPlaces(results);
                  setState('ready');
                  setHasNext(pagination.hasNextPage);
                  next.current = () => pagination.nextPage();
                  for (const place of results)
                    markers.push(
                      new maps.Marker({
                        map,
                        position: new maps.LatLng(
                          Number(place.y),
                          Number(place.x),
                        ),
                        title: place.place_name,
                      }),
                    );
                },
                { useMapBounds: true },
              );
            };
            search.current();
          },
        );
      })
      .catch(() => {
        if (!disposed) setState('error');
      });
    return () => {
      disposed = true;
      markers.forEach((marker) => marker.setMap(null));
      search.current = null;
      next.current = null;
    };
  }, [area, country, key, kind, retry]);
  if (country !== 'KR')
    return (
      <p className="panel">
        {ko
          ? '주변 시설 지도는 현재 한국 지역에서 제공해요.'
          : 'The facility map currently supports South Korea.'}
      </p>
    );
  if (!area)
    return (
      <p className="panel">
        {ko
          ? '주소 설정에서 지역을 선택해 주세요.'
          : 'Choose your area in address settings.'}
      </p>
    );
  return (
    <section className="facility-browser">
      <div
        className="community-pills"
        aria-label={ko ? '시설 종류' : 'Facility type'}
      >
        {kinds.map(([id, k, e]) => (
          <button
            type="button"
            key={id}
            aria-pressed={kind === id}
            onClick={() => setKind(id)}
          >
            {ko ? k : e}
          </button>
        ))}
      </div>
      {!key ? (
        <p className="panel">
          {ko
            ? '주변 시설 지도 연결을 준비하고 있어요.'
            : 'The facility map connection is being prepared.'}
        </p>
      ) : (
        <>
          <div
            ref={ref}
            className="facility-map"
            role="region"
            aria-label={ko ? '주변 시설 지도' : 'Nearby facilities map'}
          />
          <button
            className="button secondary"
            onClick={() =>
              state === 'error'
                ? setRetry((value) => value + 1)
                : search.current?.()
            }
          >
            {ko ? '이 지도 영역에서 찾기' : 'Search this map area'}
          </button>
          <p className="small muted" role="status">
            {state === 'loading'
              ? ko
                ? '시설을 찾고 있어요.'
                : 'Finding facilities…'
              : state === 'error'
                ? ko
                  ? '지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
                  : 'The map could not be loaded. Please try again.'
                : state === 'empty'
                  ? ko
                    ? '이 지도 영역에 등록된 시설이 없어요.'
                    : 'No facilities found in this map area.'
                  : ko
                    ? '지도에 표시된 시설 · 진료·운영 여부는 방문 전 확인해 주세요.'
                    : 'Facilities on the map · Confirm opening hours before visiting.'}
          </p>
          <div className="facility-list">
            {places.map((place) => (
              <article key={place.id} className="panel">
                <strong>
                  <MapPin size={16} />
                  {place.place_name}
                </strong>
                <p>{place.road_address_name || place.address_name}</p>
                {place.phone && (
                  <a href={`tel:${place.phone}`}>{place.phone}</a>
                )}
                <a href={place.place_url} target="_blank" rel="noreferrer">
                  {ko ? '상세·길찾기' : 'Details & directions'}{' '}
                  <ExternalLink size={14} />
                </a>
              </article>
            ))}
          </div>
          {hasNext && (
            <button
              className="button secondary"
              onClick={() => next.current?.()}
            >
              {ko ? '다음 시설' : 'Next facilities'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
