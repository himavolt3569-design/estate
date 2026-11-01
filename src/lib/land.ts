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
  residential: ['Residential', 'आवासीय'], commercial: ['Commercial', 'व्यावसायिक'], agricultural: ['Agricultural', 'कृषि'], mixed: ['Mixed use', 'मिश्रित'], other: ['Other', 'अन्य'],
  motorable: ['Motorable road', 'गाडी पुग्ने सडक'], footpath: ['Footpath', 'गोरेटो बाटो'], none: ['No direct access', 'सिधा पहुँच छैन'],
  north: ['North', 'उत्तर'], 'north-east': ['North-east', 'उत्तर-पूर्व'], east: ['East', 'पूर्व'], 'south-east': ['South-east', 'दक्षिण-पूर्व'],
  south: ['South', 'दक्षिण'], 'south-west': ['South-west', 'दक्षिण-पश्चिम'], west: ['West', 'पश्चिम'], 'north-west': ['North-west', 'उत्तर-पश्चिम'], ft: ['ft', 'फुट'], m: ['m', 'मिटर'],
};
export const landLabel = (key: string, locale = 'en') => landLabels[key]?.[locale === 'ne' ? 1 : 0] || key;
export const landArea = (land?: LandDetails | null, locale = 'en') => land && Number.isFinite(land.area) && land.area > 0
  ? `${land.area.toLocaleString(locale === 'ne' ? 'ne-NP' : 'en-NP')} ${landLabel(land.areaUnit, locale)}` : '';
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
