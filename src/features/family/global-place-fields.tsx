'use client';
import { useEffect, useId, useState } from 'react';
import { globalPlaceOptions } from './actions';
export function GlobalPlaceFields({
  country,
  locale,
  initial,
}: {
  country: string;
  locale: string;
  initial: { province: string; city: string; locality: string };
}) {
  const [province, setProvince] = useState(initial.province),
    [city, setCity] = useState(initial.city),
    [locality, setLocality] = useState(initial.locality);
  const [places, setPlaces] = useState<
    { province: string; city: string; locality: string }[]
  >([]);
  const id = useId(),
    ko = locale === 'ko';
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void globalPlaceOptions(country, province, city).then((result) => {
        if (active) setPlaces(result);
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [country, province, city]);
  const options = [
    [...new Set(places.map((p) => p.province))],
    [
      ...new Set(
        places
          .filter((p) => p.province.toLowerCase() === province.toLowerCase())
          .map((p) => p.city)
          .filter(Boolean),
      ),
    ],
    [
      ...new Set(
        places
          .filter(
            (p) =>
              p.province.toLowerCase() === province.toLowerCase() &&
              p.city.toLowerCase() === city.toLowerCase(),
          )
          .map((p) => p.locality)
          .filter(Boolean),
      ),
    ],
  ];
  return (
    <div className="form-row residence-selects">
      {[
        {
          name: 'provinceName',
          label: ko ? '시·도 (주·지역)' : 'State / province',
          value: province,
          set: (v: string) => {
            setProvince(v);
            setCity('');
            setLocality('');
          },
        },
        {
          name: 'cityName',
          label: ko ? '시·군·구 (도시·구역)' : 'City / district',
          value: city,
          set: (v: string) => {
            setCity(v);
            setLocality('');
          },
        },
        {
          name: 'localityName',
          label: ko ? '읍·면·동 (동네)' : 'Neighborhood / locality',
          value: locality,
          set: setLocality,
        },
      ].map((field, i) => (
        <label key={field.name}>
          {field.label}
          <input
            name={field.name}
            value={field.value}
            onChange={(e) => field.set(e.target.value)}
            list={`${id}-${i}`}
            required
            maxLength={80}
            placeholder={
              ko
                ? '직접 입력하거나 등록된 지역 선택'
                : 'Enter or select a registered area'
            }
          />
          <datalist id={`${id}-${i}`}>
            {options[i].map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </label>
      ))}
    </div>
  );
}
