'use client';

import { useState } from 'react';
import { Field, Input, Select } from '@/components/ui/primitives';
import { FACINGS, LAND_AREA_UNITS, LAND_USES, ROAD_ACCESS, landLabel, type LandDetails } from '@/lib/land';
import { useSiteLanguage } from './site-language';

export function LandFields({ value, required = true, onChange }: { value?: LandDetails | null; required?: boolean; onChange?: (form: FormData) => void }) {
  const { locale } = useSiteLanguage();
  const ne = locale === 'ne';
  const [access, setAccess] = useState(value?.roadAccess || '');
  const options = (values: readonly string[]) => values.map(value => <option key={value} value={value}>{landLabel(value, locale)}</option>);
  return <fieldset className="col-span-full grid min-w-0 gap-4 rounded-xl bg-ink-50 p-4 sm:grid-cols-2" onChange={event => { if (onChange && event.currentTarget.form) onChange(new FormData(event.currentTarget.form)); }}>
    <legend className="px-1 text-base font-semibold text-ink-900">{ne ? 'जग्गाको विवरण' : 'Land details'}</legend>
    <Field label={ne ? 'क्षेत्रफल' : 'Land area'} htmlFor="land-area" required={required}><Input id="land-area" name="landArea" type="number" step="any" min="0.000001" required={required} defaultValue={value?.area ?? ''} placeholder="4" /></Field>
    <Field label={ne ? 'क्षेत्रफलको एकाइ' : 'Area unit'} htmlFor="land-area-unit"><Select id="land-area-unit" name="landAreaUnit" defaultValue={value?.areaUnit || 'aana'}>{options(LAND_AREA_UNITS)}</Select></Field>
    <Field label={ne ? 'जग्गाको प्रयोग' : 'Land use'} htmlFor="land-use"><Select id="land-use" name="landUse" defaultValue={value?.landUse || ''}><option value="">{ne ? 'नखुलेको' : 'Not specified'}</option>{options(LAND_USES)}</Select></Field>
    <Field label={ne ? 'बाटोको पहुँच' : 'Road access'} htmlFor="land-road"><Select id="land-road" name="roadAccess" value={access} onChange={event => setAccess(event.target.value as typeof access)}><option value="">{ne ? 'नखुलेको' : 'Not specified'}</option>{options(ROAD_ACCESS)}</Select></Field>
    {access !== 'none' && <Field label={ne ? 'सडकको चौडाइ (वैकल्पिक)' : 'Road width (optional)'} htmlFor="land-road-width"><Input id="land-road-width" name="roadWidth" type="number" step="any" min="0.000001" defaultValue={value?.roadWidth ?? ''} /></Field>}
    <Field label={ne ? 'मोहडा (वैकल्पिक)' : 'Frontage (optional)'} htmlFor="land-frontage"><Input id="land-frontage" name="frontage" type="number" step="any" min="0.000001" defaultValue={value?.frontage ?? ''} /></Field>
    <Field label={ne ? 'चौडाइ र मोहडाको एकाइ' : 'Width & frontage unit'} htmlFor="land-length-unit"><Select id="land-length-unit" name="landLengthUnit" defaultValue={value?.lengthUnit || 'ft'}><option value="ft">{ne ? 'फुट' : 'Feet'}</option><option value="m">{ne ? 'मिटर' : 'Metres'}</option></Select></Field>
    <Field label={ne ? 'दिशा' : 'Facing'} htmlFor="land-facing"><Select id="land-facing" name="landFacing" defaultValue={value?.facing || ''}><option value="">{ne ? 'नखुलेको' : 'Not specified'}</option>{options(FACINGS)}</Select></Field>
    <p className="col-span-full text-xs leading-relaxed text-ink-600">{ne ? 'क्षेत्रफल छानिएको एकाइमै देखाइन्छ। जग्गाको प्रयोग र पहुँच जग्गाधनीसँग पुष्टि गर्नुहोस्।' : 'Area is shown in the unit entered. Confirm permitted use and access with the lister.'}</p>
  </fieldset>;
}
