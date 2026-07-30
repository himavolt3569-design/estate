import {
  ArrowRight,
  Building2,
  Home,
  LandPlot,
  Store,
  Trees,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { Reveal } from '@/components/motion/Motion';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionHeading, Skeleton } from '@/components/ui/primitives';
import { getTranslation, type Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { AreaConverter } from '@/modules/discovery/components/AreaConverter';
import { LocationSearch } from '@/modules/discovery/components/LocationSearch';
import {
  PropertyCardSkeleton,
  PropertyCardGrid,
} from '@/modules/discovery/components/PropertyCard';
import { searchProperties } from '@/modules/discovery/queries';

/*
 * Reading the locale cookie opts this route into dynamic rendering, so the
 * `revalidate = 300` that used to sit here no longer applies and has been
 * removed rather than left as a lie. Getting the edge cache back means putting
 * the locale in the URL (/ne/...), which is also what makes the Nepali pages
 * indexable. See src/i18n/index.ts.
 */

export default async function HomePage() {
  const { locale, t } = await getTranslation();

  return (
    <>
      <Hero t={t} />

      <section className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={t.verified.eyebrow}
          title={t.verified.title}
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/search?verified_only=true">
                {t.verified.seeAll} <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
        <div className="mt-8">
          <Suspense fallback={<RailSkeleton />}>
            <VerifiedRail t={t} />
          </Suspense>
        </div>
      </section>

      <BrowseByType t={t} />
      <LandUnits t={t} />
      <BrowseByProvince t={t} locale={locale} />
      <BrowseByPrice t={t} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */
/*
 * Deliberately short. A tall hero on a marketplace is a toll gate: it pushes
 * the only thing anyone came for below the fold.
 */
function Hero({ t }: { t: Dictionary }) {
  return (
    <section className="relative overflow-hidden bg-royal-900 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative mx-auto max-w-8xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p className="label label-light">{t.hero.eyebrow}</p>

        {/* The base layer sets a dark colour on headings, so a heading on the
            royal field has to say otherwise explicitly. */}
        <h1 className="mt-4 max-w-3xl text-display-md text-white">
          <span className="font-extralight text-royal-200">{t.hero.titleLight}</span>{' '}
          {t.hero.titleBold}
        </h1>

        <div className="mt-7 max-w-3xl">
          <LocationSearch t={t.hero} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: t.hero.chips.checked, href: '/search?verified_only=true' },
            { label: t.hero.chips.under1cr, href: '/search?price_max=1000000000' },
            { label: t.hero.chips.land, href: '/search?category=land' },
            { label: t.hero.chips.rent, href: '/search?transaction_type=rent' },
          ].map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="rounded-full border border-royal-400/50 px-3.5 py-1.5 text-xs text-royal-200 transition-colors hover:border-white hover:text-white"
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Verified rail: streamed, so the hero paints without waiting on the query     */
/* -------------------------------------------------------------------------- */
async function VerifiedRail({ t }: { t: Dictionary }) {
  const { items } = await searchProperties({ verified_only: true, sort: 'newest' }, null, 8);

  if (items.length === 0) {
    return (
      <EmptyState
        title={t.verified.emptyTitle}
        description={t.verified.emptyBody}
        action={
          <Button asChild variant="secondary">
            <Link href="/search">{t.verified.browseAll}</Link>
          </Button>
        }
      />
    );
  }

  return <PropertyCardGrid properties={items} priorityCount={4} />;
}

function RailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Browse by type                                                              */
/* -------------------------------------------------------------------------- */
function BrowseByType({ t }: { t: Dictionary }) {
  const types = [
    { slug: 'house', icon: Home, copy: t.types.house },
    { slug: 'apartment', icon: Building2, copy: t.types.apartment },
    { slug: 'residential_land', icon: LandPlot, copy: t.types.residentialLand },
    { slug: 'agricultural_land', icon: Trees, copy: t.types.farmLand },
    { slug: 'shop', icon: Store, copy: t.types.shop },
    { slug: 'warehouse', icon: Warehouse, copy: t.types.warehouse },
  ];

  return (
    <section className="border-t border-ink-200 bg-ink-50/40">
      <div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t.types.eyebrow} title={t.types.title} />
        <Reveal className="mt-8" stagger={0.04}>
          <ul className="grid gap-px bg-ink-200 sm:grid-cols-2 lg:grid-cols-3">
            {types.map((type) => (
              <li key={type.slug} className="reveal">
                <Link
                  href={`/search?subtype=${type.slug}`}
                  className="group flex h-full items-start gap-4 bg-white p-6 transition-colors hover:bg-royal-900"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-ink-200 text-ink-500 transition-colors group-hover:border-royal-400 group-hover:text-emerald-300">
                    <type.icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold tracking-[-0.02em] text-ink-900 transition-colors group-hover:text-white">
                      {type.copy.label}
                    </span>
                    <span className="mt-1 block text-xs text-ink-500 transition-colors group-hover:text-royal-200">
                      {type.copy.note}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="ml-auto size-4 shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-white"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Land units                                                                  */
/* -------------------------------------------------------------------------- */
/*
 * A working tool, not an explainer. Nepal runs two incompatible traditional
 * area systems and every listing is priced in one of them, so comparing a
 * valley plot against a terai plot is arithmetic nobody does in their head.
 */
function LandUnits({ t }: { t: Dictionary }) {
  return (
    <section className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow={t.converter.eyebrow}
        title={t.converter.title}
        action={
          <Button asChild variant="ghost" size="sm">
            <Link href="/search?category=land">
              {t.converter.browseLand} <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <p className="mt-4 max-w-xl text-sm text-ink-600">{t.converter.intro}</p>
      <Reveal className="mt-6">
        <div className="reveal">
          <AreaConverter t={t.converter} />
        </div>
      </Reveal>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Browse by province                                                          */
/* -------------------------------------------------------------------------- */
const PROVINCES = [
  { slug: 'bagmati', en: 'Bagmati', ne: 'बागमती', note: 'Kathmandu, Lalitpur, Bhaktapur, Chitwan', noteNe: 'काठमाडौं, ललितपुर, भक्तपुर, चितवन' },
  { slug: 'gandaki', en: 'Gandaki', ne: 'गण्डकी', note: 'Pokhara, Kaski, Tanahun', noteNe: 'पोखरा, कास्की, तनहुँ' },
  { slug: 'koshi', en: 'Koshi', ne: 'कोशी', note: 'Biratnagar, Dharan, Itahari', noteNe: 'विराटनगर, धरान, इटहरी' },
  { slug: 'lumbini', en: 'Lumbini', ne: 'लुम्बिनी', note: 'Butwal, Bhairahawa, Dang', noteNe: 'बुटवल, भैरहवा, दाङ' },
  { slug: 'madhesh', en: 'Madhesh', ne: 'मधेश', note: 'Birgunj, Janakpur', noteNe: 'वीरगञ्ज, जनकपुर' },
  { slug: 'karnali', en: 'Karnali', ne: 'कर्णाली', note: 'Surkhet, Jumla', noteNe: 'सुर्खेत, जुम्ला' },
  { slug: 'sudurpashchim', en: 'Sudurpashchim', ne: 'सुदूरपश्चिम', note: 'Dhangadhi, Kailali', noteNe: 'धनगढी, कैलाली' },
];

function BrowseByProvince({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <section className="border-t border-ink-200 bg-ink-50/40">
      <div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t.provinces.eyebrow} title={t.provinces.title} />
        <Reveal className="mt-8" stagger={0.04}>
          <ul className="grid gap-px bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
            {PROVINCES.map((province) => {
              // The reader's own script leads; the other sits beside it, because
              // both names are in daily use and place names are how people
              // recognise where they are looking.
              const primary = locale === 'ne' ? province.ne : province.en;
              const secondary = locale === 'ne' ? province.en : province.ne;
              const note = locale === 'ne' ? province.noteNe : province.note;

              return (
                <li key={province.slug} className="reveal">
                  <Link
                    href={`/search?location_path=nepal.${province.slug}`}
                    className="group flex h-full flex-col bg-white p-6 transition-colors hover:bg-royal-900"
                  >
                    <span className="flex items-baseline gap-2.5">
                      <span className="text-lg font-semibold tracking-[-0.025em] text-ink-900 transition-colors group-hover:text-white">
                        {primary}
                      </span>
                      <span
                        aria-hidden
                        className="text-sm font-light text-ink-400 transition-colors group-hover:text-royal-300"
                      >
                        {secondary}
                      </span>
                    </span>
                    <span className="mt-2 text-xs leading-relaxed text-ink-500 transition-colors group-hover:text-royal-200">
                      {note}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Browse by price                                                             */
/* -------------------------------------------------------------------------- */
/* Prices are paisa: 1 crore NPR = 10,000,000 NPR = 1,000,000,000 paisa. */
function BrowseByPrice({ t }: { t: Dictionary }) {
  const bands = [
    { label: t.price.under50, href: '/search?price_max=500000000' },
    { label: t.price.between50and1cr, href: '/search?price_min=500000000&price_max=1000000000' },
    { label: t.price.between1and2cr, href: '/search?price_min=1000000000&price_max=2000000000' },
    { label: t.price.above2cr, href: '/search?price_min=2000000000' },
  ];

  return (
    <section className="mx-auto max-w-8xl px-4 py-16 pb-24 sm:px-6 lg:px-8">
      <SectionHeading eyebrow={t.price.eyebrow} title={t.price.title} />
      <Reveal className="mt-8" stagger={0.04}>
        <ul className="grid gap-px bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
          {bands.map((band) => (
            <li key={band.label} className="reveal">
              <Link
                href={band.href}
                className="group flex h-full items-center justify-between gap-3 bg-white px-6 py-7 transition-colors hover:bg-royal-900"
              >
                <span className="text-base font-medium text-ink-900 transition-colors group-hover:text-white">
                  {band.label}
                </span>
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-300"
                />
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}

export function HomeSkeleton() {
  return <Skeleton className="h-96 w-full" />;
}
