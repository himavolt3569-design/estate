'use client';

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  LandPlot,
  Loader2,
  Send,
  Store,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { AddressAutocomplete } from '@/components/map/AddressAutocomplete';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/primitives';
import { SelectMenu } from '@/components/ui/select-menu';
import { formatIndianDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

import { createListing, submitListingForReview, updateListing } from '../actions';
import type { FeatureOption, LocationOption } from '../queries';
import {
  AREA_UNITS,
  AREA_UNIT_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  FLOOR_UNITS,
  LAND_UNITS,
  MIN_IMAGES,
  PERIOD_LABELS,
  PRICE_PERIODS,
  SUBTYPES_BY_CATEGORY,
  SUBTYPE_LABELS,
  TRANSACTION_LABELS,
  areaAsk,
  defaultAreaUnit,
  isLand,
  roomFields,
  transactionsFor,
  type Category,
  type Subtype,
  type TransactionType,
} from '../schema';
import { emptyContactNumber, type ContactNumberDraft } from '../contact-numbers';
import { ContactNumbersField } from './ContactNumbersField';
import { PhotoUploader, type UploadedImage } from './PhotoUploader';

const LocationPickerMap = dynamic(() => import('@/components/map/LocationPickerMap'), {
  ssr: false,
  loading: () => <div className="h-[320px] w-full animate-pulse rounded-xl bg-ink-100" />,
});

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

type Draft = {
  category: Category;
  subtype: Subtype;
  transactionType: TransactionType;
  price: string;
  pricePeriod: 'month' | 'year' | 'night' | null;
  priceNegotiable: boolean;

  provinceId: string;
  locationId: string;
  addressLine: string;
  lat: number;
  lng: number;
  geomPrecision: 'exact' | 'approximate';

  title: string;
  description: string;

  areaValue: string;
  areaUnit: (typeof AREA_UNITS)[number];
  bedrooms: string;
  bathrooms: string;
  floors: string;
  parking: string;
  roadAccessFt: string;
  featureIds: string[];
  showPhone: boolean;
  showEmail: boolean;
  showWhatsapp: boolean;
  contactNumbers: ContactNumberDraft[];

  ownerId: string;
};

const EMPTY: Draft = {
  category: 'residential',
  subtype: 'house',
  transactionType: 'sale',
  price: '',
  pricePeriod: null,
  priceNegotiable: false,

  provinceId: '',
  locationId: '',
  addressLine: '',
  // Kathmandu. A pin has to start somewhere, and this is where most of the
  // country's listings are; the seller drags it from here.
  lat: 27.7172,
  lng: 85.324,
  geomPrecision: 'exact',

  title: '',
  description: '',

  areaValue: '',
  areaUnit: 'ropani',
  bedrooms: '',
  bathrooms: '',
  floors: '',
  parking: '',
  roadAccessFt: '',
  featureIds: [],
  showPhone: true,
  showEmail: false,
  showWhatsapp: true,
  contactNumbers: [emptyContactNumber()],

  ownerId: '',
};

const STEPS = [
  { key: 'what', en: 'What you are listing', ne: 'के राख्दै हुनुहुन्छ' },
  { key: 'where', en: 'Where it is', ne: 'कहाँ छ' },
  { key: 'about', en: 'About the property', ne: 'विवरण' },
  { key: 'size', en: 'Size and rooms', ne: 'क्षेत्रफल र कोठा' },
  { key: 'photos', en: 'Photos', ne: 'फोटो' },
  { key: 'send', en: 'Check and send', ne: 'जाँचेर पठाउनुहोस्' },
] as const;

const BUYER_QUESTIONS = [
  'How wide is the road outside?',
  'Which way does the house face?',
  'Is there water all year?',
  'How old is the building?',
  'Is the lalpurja clear of loans?',
  'How far is the bus or school?',
];

const RENTER_QUESTIONS = [
  'Is it furnished, or empty?',
  'Is there water all year?',
  'How much is the deposit?',
  'Are electricity and water included?',
  'Is there parking for a bike or car?',
  'Who else lives in the building?',
];

const num = (value: string): number | null => {
  const digits = value.replace(/[^\d.]/g, '');
  if (digits === '') return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
};

/* -------------------------------------------------------------------------- */
/* Wizard                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Six short steps instead of one long form.
 *
 * The old page put nineteen fields, a map and a file picker on one screen and
 * asked people to get all of it right before anything was saved. Sellers who
 * had never listed a property online read that as a form for someone else. The
 * shape here is: one question per screen, plain words, and the listing is
 * saved as a draft the moment there is enough to save — so nobody can lose an
 * afternoon of typing to a bad connection.
 */
export function ListingWizard({
  provinces,
  districts,
  features,
  owners,
  isAdmin,
  existing,
}: {
  provinces: LocationOption[];
  districts: LocationOption[];
  features: FeatureOption[];
  owners: Array<{ id: string; full_name: string | null; phone: string | null }>;
  isAdmin: boolean;
  existing?: {
    id: string;
    draft: Draft;
    images: UploadedImage[];
    status: string;
  };
}) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(existing?.draft ?? EMPTY);
  const [propertyId, setPropertyId] = useState<string | null>(existing?.id ?? null);
  /*
   * The photo list lives here rather than inside PhotoUploader, because only
   * the step you are on is mounted: held one level down, everything uploaded
   * disappeared from view the moment the seller stepped back to check the
   * price, and they had no way to tell it was still saved.
   */
  const [images, setImages] = useState<UploadedImage[]>(existing?.images ?? []);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const imageCount = images.length;

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }, []);

  // A rental must carry a period and a sale must not; keeping them in step here
  // means the seller never sees the database's version of that complaint.
  useEffect(() => {
    setDraft((current) => {
      if (current.transactionType === 'sale' && current.pricePeriod !== null) {
        return { ...current, pricePeriod: null };
      }
      if (current.transactionType !== 'sale' && current.pricePeriod === null) {
        return {
          ...current,
          pricePeriod: current.transactionType === 'short_stay' ? 'night' : 'month',
        };
      }
      return current;
    });
  }, [draft.transactionType]);

  const districtsInProvince = useMemo(
    () => districts.filter((district) => district.parent_id === draft.provinceId),
    [districts, draft.provinceId],
  );

  /* What this listing is actually asked for, decided once and read everywhere. */
  const allowedTransactions = transactionsFor(draft.category);
  const ask = areaAsk(draft.category, draft.transactionType);
  const rooms = roomFields(draft.category);
  const renting = draft.transactionType !== 'sale';

  /*
   * A plot measured in ropani and a flat measured in square feet are different
   * questions, so changing the deal changes the unit — and clears the number
   * with it. Carrying "4" across from ropani to square feet would turn a
   * 4-ropani plot into a 4-square-foot flat without anybody touching the field.
   *
   * Skipped on the first run: an existing listing keeps whatever unit it was
   * saved with, even one from the other family, until the seller changes
   * something themselves.
   */
  const settled = useRef(false);
  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }

    setDraft((current) => {
      const ask = areaAsk(current.category, current.transactionType);
      const family: readonly string[] = ask === 'land' ? LAND_UNITS : FLOOR_UNITS;
      if (family.includes(current.areaUnit)) return current;
      return { ...current, areaUnit: defaultAreaUnit(ask), areaValue: '' };
    });
  }, [draft.category, draft.transactionType]);

  /* ---------------------------------------------------------------------- */
  /* Validation, per step                                                    */
  /* ---------------------------------------------------------------------- */

  function validate(index: number): boolean {
    const found: Record<string, string> = {};

    if (index === 0) {
      const price = num(draft.price);
      if (price == null || price < 1) found.price = 'Enter the price';
      else if (price > 10_000_000_000) found.price = 'That price looks too large. Check the number.';
      if (isAdmin && !draft.ownerId) found.ownerId = 'Choose whose property this is';
    }

    if (index === 1) {
      if (!draft.provinceId) found.provinceId = 'Choose the province';
      if (!draft.locationId) found.locationId = 'Choose the district';
    }

    if (index === 2) {
      const title = draft.title.trim();
      const description = draft.description.trim();
      if (title.length < 10) found.title = 'Give it a name of at least 10 characters';
      else if (title.length > 140) found.title = 'Keep the name under 140 characters';
      if (description.length < 50) {
        found.description = `Write at least 50 characters. You have ${description.length}.`;
      } else if (description.length > 5000) {
        found.description = 'Keep the description under 5000 characters';
      }
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  }

  /** Everything the create/update actions take, built from the draft. */
  function payload() {
    return {
      category: draft.category,
      subtype: draft.subtype,
      transactionType: draft.transactionType,
      price: Math.round(num(draft.price) ?? 0),
      pricePeriod: draft.pricePeriod,
      priceNegotiable: draft.priceNegotiable,

      locationId: draft.locationId,
      addressLine: draft.addressLine,
      lat: draft.lat,
      lng: draft.lng,
      geomPrecision: draft.geomPrecision,

      title: draft.title.trim(),
      description: draft.description.trim(),

      areaValue: num(draft.areaValue),
      areaUnit: draft.areaUnit,
      bedrooms: draft.bedrooms === '' ? null : Math.round(num(draft.bedrooms) ?? 0),
      bathrooms: draft.bathrooms === '' ? null : Math.round(num(draft.bathrooms) ?? 0),
      floors: draft.floors === '' ? null : Math.round(num(draft.floors) ?? 0),
      parking: draft.parking === '' ? null : Math.round(num(draft.parking) ?? 0),
      roadAccessFt: draft.roadAccessFt === '' ? null : Math.round(num(draft.roadAccessFt) ?? 0),
      featureIds: draft.featureIds,
      showPhone: draft.showPhone,
      showEmail: draft.showEmail,
      showWhatsapp: draft.showWhatsapp,
      contactNumbers: draft.contactNumbers.filter((row) => row.phone.trim().length > 0),
      ownerId: isAdmin && draft.ownerId ? draft.ownerId : null,
    };
  }

  /** Saves the draft. Called on the way out of step 3 and by "save for later". */
  async function save({ silent = false }: { silent?: boolean } = {}): Promise<string | null> {
    setSaving(true);
    try {
      const result = propertyId
        ? await updateListing({ ...payload(), id: propertyId })
        : await createListing(payload());

      if (!result.ok) {
        if (result.fieldErrors) {
          setErrors(
            Object.fromEntries(
              Object.entries(result.fieldErrors).map(([field, messages]) => [field, messages[0]!]),
            ),
          );
        }
        toast.error(result.error);
        return null;
      }

      setPropertyId(result.data.id);
      if (!silent) toast.success('Saved. You can come back to this any time.');
      return result.data.id;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (!validate(step)) return;

    // Steps 0–2 collect everything a valid row needs, so the draft lands as
    // soon as they are done rather than at the very end.
    if (step === 2) {
      const id = await save({ silent: true });
      if (!id) return;
    }

    if (step === 3 && propertyId) {
      const saved = await save({ silent: true });
      if (!saved) return;
    }

    setStep((current) => Math.min(STEPS.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back() {
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    if (!propertyId) return;

    const saved = await save({ silent: true });
    if (!saved) return;

    setSaving(true);
    const result = await submitListingForReview({ id: propertyId });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Sent for checking. We will tell you as soon as it is live.');
    router.push('/dashboard/listings');
    router.refresh();
  }

  const price = num(draft.price);

  return (
    <div className="space-y-8">
      <Stepper
        current={step}
        onJump={(index) => index < step && setStep(index)}
        // "Size and rooms" is wrong for a plot of land and wrong for a flat
        // being let, so the one step whose content changes says what it is.
        overrides={{
          size: isLand(draft.category)
            ? { en: 'Plot size', ne: 'क्षेत्रफल' }
            : renting
              ? { en: 'The space', ne: 'ठाउँको विवरण' }
              : undefined,
        }}
      />

      <div className="thread-top overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft">
        <div className="space-y-7 p-6 sm:p-8">
          {/* ---------------------------------------------------------- */}
          {step === 0 && (
            <StepShell
              title="What are you listing?"
              subtitle="Tap the answer. You can change it later."
            >
              {isAdmin && (
                <Field
                  label="Whose property is this?"
                  htmlFor="ownerId"
                  required
                  error={errors.ownerId}
                  hint="You are posting on behalf of a seller"
                >
                  <SelectMenu
                    id="ownerId"
                    value={draft.ownerId}
                    onValueChange={(value) => set('ownerId', value)}
                    placeholder="Choose the seller…"
                    options={owners.map((owner) => ({
                      value: owner.id,
                      label: owner.full_name || 'Unnamed account',
                      hint: owner.phone ?? undefined,
                    }))}
                  />
                </Field>
              )}

              <ChoiceGroup label="It is">
                {CATEGORIES.map((category) => (
                  <Choice
                    key={category}
                    selected={draft.category === category}
                    onSelect={() => {
                      set('category', category);
                      set('subtype', SUBTYPES_BY_CATEGORY[category][0] as Subtype);
                      // Land cannot be a homestay. Rather than let the seller
                      // pick something the next screen would have to argue
                      // with, the choice moves to the nearest sensible one.
                      const allowed = transactionsFor(category);
                      if (!allowed.includes(draft.transactionType)) set('transactionType', allowed[0]!);
                    }}
                    icon={
                      category === 'residential' ? Home : category === 'land' ? LandPlot : Store
                    }
                    title={CATEGORY_LABELS[category].en}
                    native={CATEGORY_LABELS[category].ne}
                    hint={CATEGORY_LABELS[category].hint}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="More exactly">
                {SUBTYPES_BY_CATEGORY[draft.category].map((subtype) => (
                  <Choice
                    key={subtype}
                    compact
                    selected={draft.subtype === subtype}
                    onSelect={() => set('subtype', subtype as Subtype)}
                    title={SUBTYPE_LABELS[subtype as Subtype].en}
                    native={SUBTYPE_LABELS[subtype as Subtype].ne}
                  />
                ))}
              </ChoiceGroup>

              <ChoiceGroup label="You are">
                {allowedTransactions.map((transaction) => (
                  <Choice
                    key={transaction}
                    compact
                    selected={draft.transactionType === transaction}
                    onSelect={() => set('transactionType', transaction)}
                    title={TRANSACTION_LABELS[transaction].en}
                    native={TRANSACTION_LABELS[transaction].ne}
                    hint={TRANSACTION_LABELS[transaction].hint}
                  />
                ))}
              </ChoiceGroup>

              <Field
                label={draft.transactionType === 'sale' ? 'Asking price' : 'Rent'}
                htmlFor="price"
                required
                error={errors.price}
              >
                <div className="flex items-center rounded-md border border-ink-200 bg-white shadow-sm transition-colors focus-within:border-royal-500 focus-within:ring-2 focus-within:ring-royal-500/20">
                  <span className="pl-4 text-sm font-medium text-ink-400">Rs</span>
                  <input
                    id="price"
                    inputMode="numeric"
                    value={draft.price === '' ? '' : formatIndianDigits(Number(draft.price))}
                    onChange={(event) =>
                      set('price', event.target.value.replace(/[^\d]/g, '').slice(0, 13))
                    }
                    placeholder="85,00,000"
                    className="nums h-12 w-full bg-transparent px-3 text-base font-semibold text-ink-900 outline-none"
                  />
                  {draft.transactionType !== 'sale' && (
                    <select
                      aria-label="Price period"
                      value={draft.pricePeriod ?? 'month'}
                      onChange={(event) =>
                        set('pricePeriod', event.target.value as (typeof PRICE_PERIODS)[number])
                      }
                      className="h-12 shrink-0 border-l border-ink-200 bg-transparent px-3 text-sm text-ink-700 outline-none"
                    >
                      {PRICE_PERIODS.map((period) => (
                        <option key={period} value={period}>
                          {PERIOD_LABELS[period]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {price != null && price > 0 && (
                  <p className="mt-1.5 text-xs text-ink-500">
                    That is <strong className="text-ink-800">{spokenPrice(price)}</strong>
                  </p>
                )}
              </Field>

              <Toggle
                checked={draft.priceNegotiable}
                onChange={(value) => set('priceNegotiable', value)}
                label="The price can be discussed"
                hint="Buyers see that you are open to an offer"
              />
            </StepShell>
          )}

          {/* ---------------------------------------------------------- */}
          {step === 1 && (
            <StepShell
              title="Where is it?"
              subtitle="Choose the district, then drag the pin to the exact spot."
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Province" htmlFor="provinceId" required error={errors.provinceId}>
                  <SelectMenu
                    id="provinceId"
                    value={draft.provinceId}
                    onValueChange={(value) => {
                      set('provinceId', value);
                      set('locationId', '');
                    }}
                    options={provinces.map((province) => ({
                      value: province.id,
                      label: province.name_en,
                      hint: province.name_ne ?? undefined,
                    }))}
                  />
                </Field>

                <Field label="District" htmlFor="locationId" required error={errors.locationId}>
                  <SelectMenu
                    id="locationId"
                    value={draft.locationId}
                    disabled={!draft.provinceId}
                    placeholder={draft.provinceId ? 'Choose…' : 'Choose a province first'}
                    onValueChange={(value) => set('locationId', value)}
                    options={districtsInProvince.map((district) => ({
                      value: district.id,
                      label: district.name_en,
                      hint: district.name_ne ?? undefined,
                    }))}
                  />
                </Field>
              </div>

              <Field
                label="Nearest landmark or street"
                htmlFor="addressLine"
                hint="Optional — a school, chowk or temple people know"
              >
                <AddressAutocomplete
                  value={draft.addressLine}
                  onChange={(value) => set('addressLine', value)}
                  onSelectLocation={(lat, lng) => {
                    set('lat', lat);
                    set('lng', lng);
                  }}
                />
              </Field>

              <div>
                <p className="text-sm font-medium text-ink-800">Put the pin on the property</p>
                <p className="mt-1 mb-3 text-xs text-ink-500">
                  Tap the map or drag the pin. Buyers use this to find the place.
                </p>
                <LocationPickerMap
                  initialPosition={{ lat: draft.lat, lng: draft.lng }}
                  onChange={({ lat, lng }) => {
                    set('lat', lat);
                    set('lng', lng);
                  }}
                  onAddressResolved={(address) => {
                    if (!draft.addressLine) set('addressLine', address);
                  }}
                  className="h-[320px] w-full overflow-hidden rounded-xl border border-ink-200"
                />
              </div>

              <Toggle
                checked={draft.geomPrecision === 'approximate'}
                onChange={(value) => set('geomPrecision', value ? 'approximate' : 'exact')}
                label="Show only the general area, not the exact house"
                hint="Use this if someone is living there now"
              />
            </StepShell>
          )}

          {/* ---------------------------------------------------------- */}
          {step === 2 && (
            <StepShell
              title="Tell people about it"
              subtitle="Write it the way you would describe it to a neighbour."
            >
              <Field
                label="Give the listing a name"
                htmlFor="title"
                required
                error={errors.title}
                hint={`${draft.title.trim().length} / 140`}
              >
                <Input
                  id="title"
                  value={draft.title}
                  maxLength={140}
                  onChange={(event) => set('title', event.target.value)}
                  placeholder="3 bedroom house with parking in Budhanilkantha"
                />
              </Field>

              <Field
                label="Describe the property"
                htmlFor="description"
                required
                error={errors.description}
                hint={`${draft.description.trim().length} / 5000`}
              >
                <Textarea
                  id="description"
                  rows={8}
                  maxLength={5000}
                  value={draft.description}
                  onChange={(event) => set('description', event.target.value)}
                  placeholder="How many rooms are there? What is nearby — school, bus, hospital? Is the road wide enough for a car? Which way does it face? Is the lalpurja clear?"
                />
              </Field>

              {/* The prompts follow the deal. Somebody looking for a flat to
                  rent does not care whether the lalpurja is clear of loans;
                  they care whether the water runs in Chaitra. */}
              <div className="rounded-xl border border-royal-100 bg-royal-50/60 p-4">
                <p className="text-xs font-semibold tracking-wide text-royal-900 uppercase">
                  {renting ? 'Things renters always ask' : 'Things buyers always ask'}
                </p>
                <ul className="mt-2.5 grid gap-1.5 text-sm text-royal-900/80 sm:grid-cols-2">
                  {(renting ? RENTER_QUESTIONS : BUYER_QUESTIONS).map((question) => (
                    <li key={question}>• {question}</li>
                  ))}
                </ul>
              </div>
            </StepShell>
          )}

          {/* ---------------------------------------------------------- */}
          {step === 3 && (
            <StepShell
              title={
                isLand(draft.category)
                  ? 'How big is the plot?'
                  : renting
                    ? 'What is inside'
                    : 'Size and rooms'
              }
              subtitle={
                renting && !isLand(draft.category)
                  ? 'Only what a tenant would ask. Leave anything blank if you are not sure.'
                  : 'Leave anything blank if you are not sure.'
              }
            >
              {/*
                A flat being rented out is not sold with the ground under it, so
                asking for the plot size in ropani is a question the landlord
                cannot answer and the tenant would not read. A sale asks for the
                land; a rental asks for the space inside; land asks for the plot
                either way.
              */}
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_11rem]">
                <Field
                  label={ask === 'land' ? 'Land size' : 'Floor area'}
                  htmlFor="areaValue"
                  hint="Optional"
                >
                  <Input
                    id="areaValue"
                    inputMode="decimal"
                    value={draft.areaValue}
                    onChange={(event) => set('areaValue', event.target.value)}
                    placeholder={ask === 'land' ? '4' : '850'}
                  />
                </Field>
                <Field label="Measured in" htmlFor="areaUnit">
                  <SelectMenu
                    id="areaUnit"
                    value={draft.areaUnit}
                    onValueChange={(value) =>
                      set('areaUnit', value as (typeof AREA_UNITS)[number])
                    }
                    options={unitOptions(ask, draft.areaUnit)}
                  />
                </Field>
              </div>

              {(rooms.bedrooms || rooms.bathrooms || rooms.floors || rooms.parking) && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {rooms.bedrooms && (
                    <Counter
                      label="Bedrooms"
                      value={draft.bedrooms}
                      onChange={(value) => set('bedrooms', value)}
                    />
                  )}
                  {rooms.bathrooms && (
                    <Counter
                      label="Bathrooms"
                      value={draft.bathrooms}
                      onChange={(value) => set('bathrooms', value)}
                    />
                  )}
                  {rooms.floors && (
                    <Counter
                      label={draft.category === 'commercial' ? 'Floors' : 'Floors in the building'}
                      value={draft.floors}
                      onChange={(value) => set('floors', value)}
                    />
                  )}
                  {rooms.parking && (
                    <Counter
                      label="Parking spaces"
                      value={draft.parking}
                      onChange={(value) => set('parking', value)}
                    />
                  )}
                </div>
              )}

              {isLand(draft.category) && (
                <Field
                  label="Width of the road outside"
                  htmlFor="roadAccessFt"
                  hint="In feet. The first thing a land buyer asks."
                >
                  <Input
                    id="roadAccessFt"
                    inputMode="numeric"
                    value={draft.roadAccessFt}
                    onChange={(event) =>
                      set('roadAccessFt', event.target.value.replace(/[^\d]/g, ''))
                    }
                    placeholder="12"
                  />
                </Field>
              )}

              {features.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium text-ink-800">What does it have?</p>
                  <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {features.map((feature) => {
                      const selected = draft.featureIds.includes(feature.id);
                      return (
                        <li key={feature.id}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              set(
                                'featureIds',
                                selected
                                  ? draft.featureIds.filter((id) => id !== feature.id)
                                  : [...draft.featureIds, feature.id],
                              )
                            }
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                              selected
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-4 shrink-0 items-center justify-center rounded border',
                                selected
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-ink-300',
                              )}
                            >
                              {selected && <Check aria-hidden className="size-3" />}
                            </span>
                            {feature.label_en}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="space-y-4 rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                <p className="text-sm font-medium text-ink-800">How should buyers reach you?</p>

                <ContactNumbersField
                  value={draft.contactNumbers}
                  onChange={(next) => set('contactNumbers', next)}
                  error={errors.contactNumbers}
                />

                <Toggle
                  checked={draft.showPhone}
                  onChange={(value) => set('showPhone', value)}
                  label="Show my phone number"
                />
                <Toggle
                  checked={draft.showWhatsapp}
                  onChange={(value) => set('showWhatsapp', value)}
                  label="Show WhatsApp"
                />
                <Toggle
                  checked={draft.showEmail}
                  onChange={(value) => set('showEmail', value)}
                  label="Show my email address"
                />
              </div>
            </StepShell>
          )}

          {/* ---------------------------------------------------------- */}
          {step === 4 && (
            <StepShell
              title="Add photos"
              subtitle={`At least ${MIN_IMAGES}. Listings with clear photos get far more calls.`}
            >
              {propertyId ? (
                <PhotoUploader propertyId={propertyId} images={images} onChange={setImages} />
              ) : (
                <p className="rounded-xl border border-clay-200 bg-clay-50 px-4 py-3 text-sm text-clay-800">
                  Go back and finish the earlier steps first — photos are attached to the saved
                  listing.
                </p>
              )}
            </StepShell>
          )}

          {/* ---------------------------------------------------------- */}
          {step === 5 && (
            <StepShell
              title="Check it over"
              subtitle="Nothing is public yet. We look at every listing before it goes live."
            >
              <dl className="grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-2">
                <Summary label="Name" value={draft.title || '—'} />
                <Summary
                  label={draft.transactionType === 'sale' ? 'Asking price' : 'Rent'}
                  value={
                    price
                      ? `Rs ${formatIndianDigits(price)}${
                          draft.pricePeriod ? ` ${PERIOD_LABELS[draft.pricePeriod]}` : ''
                        }`
                      : '—'
                  }
                />
                <Summary
                  label="Type"
                  value={`${SUBTYPE_LABELS[draft.subtype].en} · ${TRANSACTION_LABELS[draft.transactionType].en}`}
                />
                <Summary
                  label="District"
                  value={
                    districts.find((district) => district.id === draft.locationId)?.name_en ?? '—'
                  }
                />
                <Summary
                  label={ask === 'land' ? 'Land size' : 'Floor area'}
                  value={
                    draft.areaValue
                      ? `${draft.areaValue} ${AREA_UNIT_LABELS[draft.areaUnit].toLowerCase()}`
                      : 'Not stated'
                  }
                />
                <Summary label="Photos" value={`${imageCount}`} />
              </dl>

              {imageCount < MIN_IMAGES && (
                <p className="rounded-xl border border-marigold-200 bg-marigold-50 px-4 py-3 text-sm text-marigold-900">
                  You need {MIN_IMAGES - imageCount} more{' '}
                  {MIN_IMAGES - imageCount === 1 ? 'photo' : 'photos'} before this can be checked.{' '}
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="font-semibold underline underline-offset-2"
                  >
                    Add photos
                  </button>
                </p>
              )}

              <div className="rounded-xl border border-royal-100 bg-royal-50/60 p-4 text-sm leading-relaxed text-royal-900/85">
                When you send it, our team checks the details and the photos. That usually takes a
                day. You will get a message either way, and you can keep editing it in the meantime.
              </div>
            </StepShell>
          )}
        </div>

        {/* ------------------------------------------------------------ */}
        {/* Footer                                                        */}
        {/* ------------------------------------------------------------ */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/60 px-6 py-4 sm:px-8">
          <Button
            type="button"
            variant="ghost"
            onClick={back}
            disabled={step === 0 || saving}
            className={cn(step === 0 && 'invisible')}
          >
            <ArrowLeft aria-hidden /> Back
          </Button>

          <div className="flex items-center gap-3">
            {propertyId && step < STEPS.length - 1 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void save()}
                disabled={saving}
              >
                Save for later
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => void next()} disabled={saving}>
                {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {saving ? 'Saving…' : 'Continue'}
                {!saving && <ArrowRight aria-hidden />}
              </Button>
            ) : (
              <Button
                type="button"
                variant="approve"
                onClick={() => void submit()}
                disabled={saving || imageCount < MIN_IMAGES || !propertyId}
              >
                {saving ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
                Send for checking
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                      */
/* -------------------------------------------------------------------------- */

function Stepper({
  current,
  onJump,
  overrides = {},
}: {
  current: number;
  onJump: (index: number) => void;
  overrides?: Partial<Record<(typeof STEPS)[number]['key'], { en: string; ne: string } | undefined>>;
}) {
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2">
      {STEPS.map((entry, index) => {
        const step = { ...entry, ...(overrides[entry.key] ?? {}) };
        const done = index < current;
        const active = index === current;

        return (
          <li key={step.key} className="flex-1 basis-32">
            <button
              type="button"
              onClick={() => onJump(index)}
              disabled={index >= current}
              className="w-full text-left disabled:cursor-default"
            >
              <span
                className={cn(
                  'block h-1 rounded-full transition-colors',
                  active ? 'thread' : done ? 'bg-emerald-500' : 'bg-ink-200',
                )}
              />
              <span
                className={cn(
                  'mt-2 block text-xs leading-tight font-medium',
                  active ? 'text-ink-900' : done ? 'text-emerald-700' : 'text-ink-400',
                )}
              >
                {step.en}
              </span>
              <span aria-hidden className="mt-0.5 block text-2xs leading-tight text-ink-400">
                {step.ne}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h2>
        <p className="mt-1.5 text-sm text-ink-600">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ChoiceGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-ink-800">{label}</legend>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Choice({
  selected,
  onSelect,
  icon: Icon,
  title,
  native,
  hint,
  compact = false,
}: {
  selected: boolean;
  onSelect: () => void;
  icon?: React.ElementType;
  title: string;
  native: string;
  hint?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex h-full flex-col items-start gap-1 rounded-xl border-2 text-left transition-all',
        compact ? 'p-3' : 'p-4',
        selected
          ? 'border-crimson-500 bg-crimson-50 shadow-sm'
          : 'border-ink-200 bg-white hover:border-crimson-200 hover:bg-crimson-50/40',
      )}
    >
      {Icon && (
        <Icon
          aria-hidden
          className={cn('mb-1.5 size-5', selected ? 'text-crimson-600' : 'text-ink-400')}
        />
      )}
      <span
        className={cn(
          'text-sm leading-tight font-semibold',
          selected ? 'text-crimson-900' : 'text-ink-900',
        )}
      >
        {title}
      </span>
      <span aria-hidden className="text-xs text-ink-500">
        {native}
      </span>
      {hint && <span className="mt-0.5 text-2xs leading-snug text-ink-400">{hint}</span>}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
          checked ? 'bg-emerald-600' : 'bg-ink-300',
        )}
      >
        <span
          className={cn(
            'size-5 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
      <span>
        <span className="block text-sm text-ink-800">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-ink-500">{hint}</span>}
      </span>
    </label>
  );
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const current = value === '' ? 0 : Number(value);

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink-800">{label}</p>
      <div className="flex items-center rounded-md border border-ink-200 bg-white shadow-sm">
        <button
          type="button"
          aria-label={`One fewer ${label.toLowerCase()}`}
          onClick={() => onChange(current <= 0 ? '' : String(current - 1))}
          className="h-11 w-11 shrink-0 text-lg text-ink-500 hover:bg-ink-50 hover:text-ink-900"
        >
          −
        </button>
        <input
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, '').slice(0, 3))}
          placeholder="—"
          aria-label={label}
          className="nums h-11 w-full min-w-0 border-x border-ink-200 bg-transparent text-center text-base font-semibold text-ink-900 outline-none"
        />
        <button
          type="button"
          aria-label={`One more ${label.toLowerCase()}`}
          onClick={() => onChange(String(current + 1))}
          className="h-11 w-11 shrink-0 text-lg text-ink-500 hover:bg-ink-50 hover:text-ink-900"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Only the units that belong to the question being asked. A listing edited
 * before this rule existed may already hold a unit from the other family, so
 * that one is kept in the list rather than silently swapped underneath the
 * seller.
 */
function unitOptions(ask: 'land' | 'floor', current: (typeof AREA_UNITS)[number]) {
  const family: readonly string[] = ask === 'land' ? LAND_UNITS : FLOOR_UNITS;
  const units = family.includes(current) ? family : [...family, current];
  return units.map((unit) => ({
    value: unit,
    label: AREA_UNIT_LABELS[unit as (typeof AREA_UNITS)[number]],
  }));
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="label">{label}</dt>
      <dd className="mt-1.5 text-sm font-medium break-words text-ink-900">{value}</dd>
    </div>
  );
}

function spokenPrice(rupees: number): string {
  if (rupees >= 10_000_000) {
    return `${(rupees / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} crore`;
  }
  if (rupees >= 100_000) {
    return `${(rupees / 100_000).toFixed(2).replace(/\.?0+$/, '')} lakh`;
  }
  return `Rs ${formatIndianDigits(rupees)}`;
}
