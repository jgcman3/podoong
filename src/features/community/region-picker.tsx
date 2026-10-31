'use client';
import { useState } from 'react';
import { residenceRegions } from '@/features/family/residence-regions';
import type { Locale } from '@/lib/domain';
export function CommunityRegionPicker({
  locale,
  country,
  place,
  child,
  scope,
  category,
  path,
  globalPlaces = [],
}: {
  locale: Locale;
  country: string | null;
  place: string;
  child: string;
  scope: string;
  category: string;
  path: string;
  globalPlaces?: {
    id: string;
    province: string;
    city: string;
    locality: string;
  }[];
}) {
  const ko = locale === 'ko';
  const initial = residenceRegions.find((r) => r.code === place);
  const [province, setProvince] = useState(initial?.provinceCode ?? '');
  const [city, setCity] = useState(initial?.cityCode ?? '');
  const [locality, setLocality] = useState(initial?.code ?? '');
  const provinces = [
    ...new Map(
      residenceRegions.map((r) => [r.provinceCode, r.province]),
    ).entries(),
  ];
  const cities = [
    ...new Map(
      residenceRegions
        .filter((r) => r.provinceCode === province)
        .map((r) => [r.cityCode, r.city]),
    ).entries(),
  ];
  return (
    <details className="community-region-picker">
      <summary>{ko ? '다른 지역 보기' : 'Browse another area'}</summary>
      <form action={path} className="community-region-form">
        <input type="hidden" name="child" value={child} />
        <input
          type="hidden"
          name="scope"
          value={scope === 'all' ? 'district' : scope}
        />
        <input type="hidden" name="category" value={category} />
        {country === 'KR' ? (
          <>
            <label>
              {ko ? '시·도' : 'Province / city'}
              <select
                required
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value);
                  setCity('');
                  setLocality('');
                }}
              >
                <option value="">{ko ? '선택' : 'Choose'}</option>
                {provinces.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {ko ? '시·군·구' : 'District'}
              <select
                required
                value={city}
                disabled={!province}
                onChange={(e) => {
                  setCity(e.target.value);
                  setLocality('');
                }}
              >
                <option value="">{ko ? '선택' : 'Choose'}</option>
                {cities.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {ko ? '읍·면·동' : 'Neighborhood'}
              <select
                name="place"
                required
                value={locality}
                disabled={!city}
                onChange={(e) => setLocality(e.target.value)}
              >
                <option value="">{ko ? '선택' : 'Choose'}</option>
                {residenceRegions
                  .filter((r) => r.cityCode === city)
                  .map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.locality}
                    </option>
                  ))}
              </select>
            </label>
          </>
        ) : (
          <label>
            {ko ? '지역' : 'Area'}
            <select name="place" defaultValue={place}>
              <option value="">{ko ? '우리 동네' : 'My neighborhood'}</option>
              {globalPlaces.map((p) => (
                <option value={p.id} key={p.id}>
                  {[p.province, p.city, p.locality].join(' · ')}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="button secondary">
          {ko ? '이 지역 보기' : 'Show area'}
        </button>
      </form>
    </details>
  );
}
