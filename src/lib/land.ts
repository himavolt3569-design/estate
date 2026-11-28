import {
  NEPALI_AREA_IN_SQM,
  nepaliAreaParts,
  nepaliAreaToSqm,
  metresToFeet,
} from './nepali-land';

export const LAND_AREA_UNITS = ['aana', 'ropani', 'paisa', 'daam', 'kattha', 'bigha', 'dhur', 'sqft', 'sqm'] as const;
export const LAND_USES = ['residential', 'commercial', 'agricultural', 'mixed', 'other'] as const;
export const ROAD_ACCESS = ['motorable', 'footpath', 'none'] as const;
export const FACINGS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;
export type LandDetails = {
  area: number;
  areaUnit: typeof LAND_AREA_UNITS[number];
  landUse?: typeof LAND_USES[number] | '';
  roadAccess?: typeof ROAD_ACCESS[number] | '';
  roadWidth?: number;
  frontage?: number;
  lengthUnit?: 'ft' | 'm';
  facing?: typeof FACINGS[number] | '';
};
export const landLabels: Record<string, [string, string]> = {
  aana: ['Aana', 'आना'], ropani: ['Ropani', 'रोपनी'], paisa: ['Paisa', 'पैसा'], daam: ['Daam', 'दाम'],
  kattha: ['Kattha', 'कट्ठा'], bigha: ['Bigha', 'बिघा'], dhur: ['Dhur', 'धुर'], sqft: ['sq ft', 'वर्ग फुट'], sqm: ['sq m', 'वर्ग मिटर'],
  hectare: ['Hectare', 'हेक्टर'],
  residential: ['Residential', 'आवासीय'], commercial: ['Commercial', 'व्यावसायिक'], agricultural: ['Agricultural', 'कृषि'], mixed: ['Mixed use', 'मिश्रित'], other: ['Other', 'अन्य'],
  motorable: ['Motorable road', 'गाडी पुग्ने सडक'], footpath: ['Footpath', 'गोरेटो बाटो'], none: ['No direct access', 'सिधा पहुँच छैन'],
  north: ['North', 'उत्तर'], 'north-east': ['North-east', 'उत्तर-पूर्व'], east: ['East', 'पूर्व'], 'south-east': ['South-east', 'दक्षिण-पूर्व'],
  south: ['South', 'दक्षिण'], 'south-west': ['South-west', 'दक्षिण-पश्चिम'], west: ['West', 'पश्चिम'], 'north-west': ['North-west', 'उत्तर-पश्चिम'], ft: ['ft', 'फुट'], m: ['m', 'मिटर'],
};
export const landLabel = (key: string, locale = 'en') => landLabels[key]?.[locale === 'ne' ? 1 : 0] || key;
export const landArea = (land?: LandDetails | null, locale = 'en') => land && Number.isFinite(land.area) && land.area > 0
  ? `${land.area.toLocaleString(locale === 'ne' ? 'ne-NP' : 'en-NP')} ${landLabel(land.areaUnit, locale)}` : '';

export type DualLandSize = {
  entered: string;
  sqm: number;
  metricShort: string;
  nepaliShort: string;
  compact: string;
};

const METRES_PER_FOOT = 0.3048;
const TERAI_UNITS = new Set(['bigha', 'kattha', 'dhur']);

function formatCompactNumber(value: number, locale = 'en', maxDecimals = 2): string {
  const ne = locale === 'ne';
  return new Intl.NumberFormat(ne ? 'ne-NP' : 'en-NP', {
    numberingSystem: ne ? 'deva' : 'latn',
    ...(value !== 0 && Math.abs(value) < 10 ** -maxDecimals
      ? { maximumSignificantDigits: 3 }
      : { maximumFractionDigits: maxDecimals }),
  }).format(value);
}

/** Convert entered land area details to exact square metres, or null if missing/invalid. */
export function landAreaSqm(land?: LandDetails | null): number | null {
  if (!land || !Number.isFinite(land.area) || land.area <= 0) return null;
  if (!(land.areaUnit in NEPALI_AREA_IN_SQM)) return null;
  try {
    return nepaliAreaToSqm(land.area, land.areaUnit);
  } catch {
    return null;
  }
}

/** Build symmetrical Nepali and Metric size strings from a listing's LandDetails. */
export function landAreaDual(land?: LandDetails | null, locale = 'en'): DualLandSize | null {
  const sqm = landAreaSqm(land);
  if (sqm === null || !land) return null;

  const entered = landArea(land, locale);
  const metricShort = `${formatCompactNumber(sqm, locale, 2)} m²`;

  const system = TERAI_UNITS.has(land.areaUnit) ? 'bigha' : 'ropani';
  const systemUnits = system === 'bigha' ? (['bigha', 'kattha', 'dhur'] as const) : (['ropani', 'aana', 'paisa', 'daam'] as const);
  const parts = nepaliAreaParts(sqm, system, 2);
  const nonZeroParts = systemUnits
    .map((unit, index) => ({ unit, count: parts[index] ?? 0 }))
    .filter((entry) => entry.count > 0);
  const nepaliShort = nonZeroParts.length
    ? nonZeroParts.map(({ unit, count }) => `${formatCompactNumber(count, locale, 2)} ${landLabel(unit, locale)}`).join(' ')
    : `0 ${landLabel(systemUnits[systemUnits.length - 1]!, locale)}`;

  const compact = land.areaUnit === 'sqm'
    ? `${metricShort} · ${nepaliShort}`
    : `${entered} · ${metricShort}`;

  return { entered, sqm, metricShort, nepaliShort, compact };
}

/** Format a positive length showing metric (m) first and feet (ft) in parentheses. */
export function formatDualLength(value?: number, unit: 'ft' | 'm' = 'ft', locale = 'en'): string {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return '';
  const metres = unit === 'm' ? value : value * METRES_PER_FOOT;
  const feet = unit === 'm' ? metresToFeet(value) : value;
  return `${formatCompactNumber(metres, locale, 2)} ${landLabel('m', locale)} (${formatCompactNumber(feet, locale, 2)} ${landLabel('ft', locale)})`;
}

/** Return land boundary/access facts with dual m+ft widths and frontages (excluding area). */
export function landMeasurementFacts(land?: LandDetails | null, locale = 'en'): { label: string; value: string }[] {
  const ne = locale === 'ne';
  if (!land) return [];
  const unit = land.lengthUnit || 'ft';
  return [
    { label: ne ? 'जग्गाको प्रयोग' : 'Land use', value: landLabel(land.landUse || '', locale) },
    { label: ne ? 'बाटोको पहुँच' : 'Road access', value: landLabel(land.roadAccess || '', locale) },
    { label: ne ? 'सडकको चौडाइ' : 'Road width', value: land.roadAccess === 'none' ? '' : formatDualLength(land.roadWidth, unit, locale) },
    { label: ne ? 'मोहडा' : 'Frontage', value: formatDualLength(land.frontage, unit, locale) },
    { label: ne ? 'दिशा' : 'Facing', value: landLabel(land.facing || '', locale) },
  ].filter(fact => fact.value);
}

export function landFacts(land?: LandDetails | null, locale = 'en') {
  const ne = locale === 'ne';
  if (!land) return [];
  const length = (value?: number) => value && Number.isFinite(value) ? `${value} ${landLabel(land.lengthUnit || 'ft', locale)}` : '';
  return [
    { label: ne ? 'जग्गाको क्षेत्रफल' : 'Land area', value: landArea(land, locale) },
    { label: ne ? 'जग्गाको प्रयोग' : 'Land use', value: landLabel(land.landUse || '', locale) },
    { label: ne ? 'बाटोको पहुँच' : 'Road access', value: landLabel(land.roadAccess || '', locale) },
    { label: ne ? 'सडकको चौडाइ' : 'Road width', value: land.roadAccess === 'none' ? '' : length(land.roadWidth) },
    { label: ne ? 'मोहडा' : 'Frontage', value: length(land.frontage) },
    { label: ne ? 'दिशा' : 'Facing', value: landLabel(land.facing || '', locale) },
  ].filter(fact => fact.value);
}

/** A legacy land record can remain without area until its owner supplies it. */
export function landFromForm(form: FormData, required = true): LandDetails | null {
  const rawArea = String(form.get('landArea') || '').trim();
  if (!rawArea && !required) return null;
  const area = Number(rawArea);
  const areaUnit = String(form.get('landAreaUnit') || 'aana');
  const landUse = String(form.get('landUse') || '');
  const roadAccess = String(form.get('roadAccess') || '');
  const facing = String(form.get('landFacing') || '');
  if (!Number.isFinite(area) || area <= 0 || !LAND_AREA_UNITS.includes(areaUnit as LandDetails['areaUnit'])) throw new Error('Enter a land area greater than zero and choose its unit.');
  if (landUse && !LAND_USES.includes(landUse as typeof LAND_USES[number]) || roadAccess && !ROAD_ACCESS.includes(roadAccess as typeof ROAD_ACCESS[number]) || facing && !FACINGS.includes(facing as typeof FACINGS[number])) throw new Error('Choose valid land details.');
  const result: LandDetails = { area, areaUnit: areaUnit as LandDetails['areaUnit'], landUse: landUse as LandDetails['landUse'], roadAccess: roadAccess as LandDetails['roadAccess'], facing: facing as LandDetails['facing'], lengthUnit: form.get('landLengthUnit') === 'm' ? 'm' : 'ft' };
  for (const [name, key] of [['roadWidth', 'roadWidth'], ['frontage', 'frontage']] as const) {
    if (name === 'roadWidth' && roadAccess === 'none') continue;
    const raw = String(form.get(name) || '').trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Road width and frontage must be greater than zero when provided.');
    result[key] = value;
  }
  return result;
}
