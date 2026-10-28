'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormStatus } from 'react-dom';
import type { Locale } from '@/lib/domain';
import type { Row } from '@/lib/db';
import { saveFamilyResidence } from './actions';
import countries from './countries.json';
import { residenceRegions } from './residence-regions';
const provinces = [
  ...new Map(
    residenceRegions.map((r) => [r.provinceCode, r.province]),
  ).entries(),
];
function SaveButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations();
  const { pending } = useFormStatus();
  return (
    <button className="button primary" disabled={disabled || pending}>
      {t('residenceSave')}
    </button>
  );
}
export function ResidenceForm({
  family,
  childId,
  locale,
  returnPage = 'family',
}: {
  family: Row<'families'>;
  childId: string;
  locale: Locale;
  returnPage?: 'family' | 'account';
}) {
  const t = useTranslations();
  const initial = residenceRegions.find(
    (r) =>
      family.residence_country_code === 'KR' &&
      r.code === family.residence_region_code,
  );
  const [country, setCountry] = useState(family.residence_country_code ?? 'KR');
  const [province, setProvince] = useState(initial?.provinceCode ?? '');
  const [city, setCity] = useState(initial?.cityCode ?? '');
  const [regionCode, setRegionCode] = useState(initial?.code ?? '');
  const [cleared, setCleared] = useState(false);
  const cities = [
    ...new Map(
      residenceRegions
        .filter((r) => r.provinceCode === province)
        .map((r) => [r.cityCode, r.city]),
    ).entries(),
  ];
  const localities = residenceRegions.filter((r) => r.cityCode === city);
  return (
    <form action={saveFamilyResidence} className="form-stack">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnPage" value={returnPage} />
      <input type="hidden" name="panel" value="family" />
      <input type="hidden" name="familyId" value={family.id} />
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="version" value={family.residence_version} />
      <input type="hidden" name="regionCode" value={regionCode} />
      <label>
        {t('residenceCountry')}
        <select
          name="countryCode"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setProvince('');
            setCity('');
            setRegionCode('');
            setCleared(false);
          }}
        >
          <option value="">{t('residenceChoose')}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c[locale]}
            </option>
          ))}
        </select>
      </label>
      {country === 'KR' && (
        <div className="form-row residence-selects">
          <label>
            {t('residenceProvince')}
            <select
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setCity('');
                setRegionCode('');
                setCleared(false);
              }}
            >
              <option value="">{t('residenceChoose')}</option>
              {provinces.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('residenceCity')}
            <select
              value={city}
              disabled={!province}
              onChange={(e) => {
                setCity(e.target.value);
                setRegionCode('');
                setCleared(false);
              }}
            >
              <option value="">{t('residenceChoose')}</option>
              {cities.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('residenceLocality')}
            <select
              value={regionCode}
              disabled={!city}
              onChange={(e) => {
                setRegionCode(e.target.value);
                setCleared(false);
              }}
            >
              <option value="">{t('residenceChoose')}</option>
              {localities.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.locality}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <p className="small muted">
        {cleared
          ? t('residenceRemovalPending')
          : country === 'KR'
            ? t('residenceSelectHelp')
            : t('residenceGlobalHelp')}
      </p>
      <div className="residence-actions">
        <SaveButton
          disabled={
            (!country && !cleared) ||
            (country === 'KR' && !!province && !regionCode)
          }
        />
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setCountry('');
            setProvince('');
            setCity('');
            setRegionCode('');
            setCleared(true);
          }}
        >
          {t('residenceRemove')}
        </button>
      </div>
    </form>
  );
}
