import {
  ArrowRight,
  Building2,
  Home,
  LandPlot,
  Store,
  Warehouse,
  ShieldCheck,
  BadgeCent,
  UserCheck,
  Tent
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';

import { Reveal } from '@/components/motion/Motion';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/primitives';
import { getTranslation, type Dictionary } from '@/i18n';
import type { Locale } from '@/i18n/config';
import { AreaConverter } from '@/modules/discovery/components/AreaConverter';
import { EmiCalculator } from '@/modules/finance/components/EmiCalculator';
import { HeroSearch } from '@/modules/discovery/components/HeroSearch';
import { searchProperties } from '@/modules/discovery/queries';
import { getHeroImageUrl } from '@/modules/platform/site-media';
import { InfiniteScrollPropertyGrid } from '@/modules/discovery/components/InfiniteScrollPropertyGrid';
import { PropertyCardSkeleton } from '@/modules/discovery/components/PropertyCard';

export default async function HomePage() {
  const [{ locale, t }, heroUrl] = await Promise.all([getTranslation(), getHeroImageUrl()]);

  return (
    <>
      <Hero backgroundUrl={heroUrl} />

      <section className="mx-auto max-w-8xl px-4 py-12 sm:mt-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <SectionHeading
            eyebrow="Featured"
            title="Featured Properties"
          />
          <Link href="/search" className="text-sm font-semibold text-royal-600 flex items-center hover:underline">
            View All Properties <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <Suspense fallback={<RailSkeleton />}>
              <FeaturedPropertiesRail t={t} />
            </Suspense>
          </div>
          <div className="lg:col-span-1">
            <RightRail />
          </div>
        </div>
      </section>

      <BrowseByType />

      <EmiSection t={t} />

      <div className="bg-white">
        <LandUnits t={t} />
      </div>

      {/* Last on the page. The two calculators are what someone came to use;
          the province grid is a way out of the page for anyone who did not
          find what they wanted above it. */}
      <BrowseByProvince t={t} locale={locale} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Monthly payment                                                             */
/* -------------------------------------------------------------------------- */
/*
 * This replaces the old "search by price" bands. Price bands only ever restated
 * what the search filters already did; the question a first-time buyer in Nepal
 * actually arrives with is whether they can carry the instalment at all.
 */
function EmiSection({ t }: { t: Dictionary }) {
  return (
    <section className="border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t.emi.eyebrow} title={t.emi.title} />
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-600">{t.emi.intro}</p>
        <Reveal className="mt-8">
          <div className="reveal">
            <EmiCalculator t={t.emi} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero                                                                        */
/* -------------------------------------------------------------------------- */
/**
 * Nothing about this section moved. The only change is that the picture behind
 * it is whatever the master admin last uploaded, falling back to the image that
 * ships with the build when they have not set one.
 */
function Hero({ backgroundUrl }: { backgroundUrl: string | null }) {
  return (
    <section className="relative flex min-h-[520px] flex-col items-center justify-center pt-12 pb-8 sm:min-h-[600px] sm:pt-16 sm:pb-32">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src={backgroundUrl ?? '/images/hero-bg.png'}
          alt=""
          fill
          sizes="100vw"
          className="object-cover brightness-[0.85]"
          priority
          // An admin-supplied URL is not a build-time asset, so the optimiser
          // has no configured remote pattern for it. Serving it directly keeps
          // the upload working the moment it lands.
          unoptimized={Boolean(backgroundUrl)}
        />
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-royal-950/80 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-8xl px-4 sm:px-6 lg:px-8 flex flex-col items-start">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-6xl lg:text-7xl">
          Find Your <br /> Dream Home
        </h1>
        <p className="mt-5 max-w-xl text-base font-medium text-white drop-shadow-md sm:mt-6 sm:text-lg">
          Discover the perfect property that matches your lifestyle and budget.
        </p>

        <Button asChild size="lg" className="mt-7 h-13 px-7 text-base font-semibold sm:mt-8 sm:h-14 sm:px-8 sm:text-lg">
          <Link href="/search">
            Explore Properties <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>

      {/* Floats over the hero edge from sm up; in flow on a phone. */}
      <div className="relative z-20 mx-auto mt-8 w-full max-w-6xl px-4 sm:absolute sm:-bottom-16 sm:mt-0 sm:px-6 lg:px-8">
        <HeroSearch />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Featured Properties Rail                                                    */
/* -------------------------------------------------------------------------- */
/*
 * This rail used to ask for `verified_only: true`, which is a filter, not a
 * ranking. Nothing on the platform sets properties.verified_at — there was no
 * control anywhere in the admin that could — so the filter matched zero rows and
 * the home page was permanently empty while /search showed the same listings
 * without complaint.
 *
 * `verified_first` is the ranking that was actually wanted: a checked listing
 * earns the top of the page, an unchecked but published one is still on it, and
 * the page fills the moment a listing is approved rather than waiting for a
 * second manual step. Expired, draft, pending, rejected and deleted listings are
 * excluded inside search_properties() for every caller.
 */
const HOME_RAIL_FILTERS = { sort: 'verified_first' } as const;

async function FeaturedPropertiesRail({ t }: { t: Dictionary }) {
  const { items, nextCursor, error } = await searchProperties(HOME_RAIL_FILTERS, null, 6);

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-clay-200 bg-clay-50 p-12 text-center"
      >
        <h3 className="text-lg font-semibold text-ink-900">Listings could not be loaded</h3>
        <p className="mt-2 mb-6 text-ink-600">
          This is a problem on our side, not with your connection. Try again in a moment.
        </p>
        <Button asChild variant="secondary">
          <Link href="/search">{t.verified.browseAll}</Link>
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-12 text-center bg-ink-50 rounded-2xl border border-ink-100">
        <h3 className="text-lg font-semibold text-ink-900">{t.verified.emptyTitle}</h3>
        <p className="mt-2 text-ink-500 mb-6">{t.verified.emptyBody}</p>
        <Button asChild variant="secondary">
          <Link href="/search">{t.verified.browseAll}</Link>
        </Button>
      </div>
    );
  }

  return (
    <InfiniteScrollPropertyGrid
      initialItems={items}
      initialCursor={nextCursor}
      filters={HOME_RAIL_FILTERS}
    />
  );
}

function RailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Right Rail (Trust Badges)                                                   */
/* -------------------------------------------------------------------------- */
function RightRail() {
  return (
    <div className="sticky top-24 rounded-2xl bg-ink-50/50 border border-ink-100 p-8 flex flex-col h-full lg:h-auto">
      <div className="space-y-8 flex-1">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-royal-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-ink-900">Verified Properties</h4>
            <p className="mt-1 text-sm text-ink-500">All properties are verified for your peace of mind.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-royal-600">
            <BadgeCent className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-ink-900">Best Price Guarantee</h4>
            <p className="mt-1 text-sm text-ink-500">Get the best value for your money.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-royal-600">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-ink-900">Expert Agents</h4>
            <p className="mt-1 text-sm text-ink-500">Our agents are here to help you find your dream home.</p>
          </div>
        </div>
      </div>

      <Button asChild size="lg" className="mt-10 w-full bg-royal-600 hover:bg-royal-700 text-white rounded-lg">
        <Link href="/about">
          Learn More About Us <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Browse by type                                                              */
/* -------------------------------------------------------------------------- */
function BrowseByType() {
  /*
   * `query` rather than a bare subtype, because two of these are not subtypes
   * at all. "Home stay" is a transaction type, and the tile labelled Villa was
   * pointing at `warehouse`. Both were being fed into a property_subtype[] cast
   * that rejected them, so those two tiles returned nothing at all.
   */
  const types = [
    { query: 'subtype=house', icon: Home, label: 'Houses', note: 'Family homes', bg: 'bg-royal-50', text: 'text-royal-600' },
    { query: 'subtype=apartment', icon: Building2, label: 'Apartments', note: 'Flats and studios', bg: 'bg-crimson-50', text: 'text-crimson-600' },
    { query: 'category=land', icon: LandPlot, label: 'Land', note: 'Ghaderi and fields', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { query: 'category=commercial', icon: Store, label: 'Shops and offices', note: 'For business', bg: 'bg-marigold-50', text: 'text-marigold-700' },
    { query: 'transaction_type=short_stay', icon: Tent, label: 'Home stay', note: 'By the night', bg: 'bg-sand-100', text: 'text-sand-700' },
    { query: 'subtype=villa', icon: Warehouse, label: 'Villas', note: 'Larger houses', bg: 'bg-ink-100', text: 'text-ink-600' },
  ];

  return (
    <section className="bg-ink-50/40">
      <div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading title="Browse Properties By Type" />
        <Reveal className="mt-8" stagger={0.04}>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {types.map((type) => (
              <li key={type.query} className="reveal h-full">
                <Link
                  href={`/search?${type.query}`}
                  className="group flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-6 shadow-sm border border-ink-100 transition-all hover:shadow-md hover:-translate-y-1 text-center h-full"
                >
                  <span className={`flex size-14 items-center justify-center rounded-full ${type.bg} ${type.text} transition-transform group-hover:scale-110`}>
                    <type.icon aria-hidden className="size-6" />
                  </span>
                  <div>
                    <span className="block text-base font-bold text-ink-900 transition-colors group-hover:text-crimson-700">
                      {type.label}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-ink-500">
                      {type.note}
                    </span>
                  </div>
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
function LandUnits({ t }: { t: Dictionary }) {
  return (
    <section className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8 border-t border-ink-100">
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
    <section className="border-t border-ink-100 bg-ink-50/40 pb-16">
      <div className="mx-auto max-w-8xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeading eyebrow={t.provinces.eyebrow} title={t.provinces.title} />
        <Reveal className="mt-8" stagger={0.04}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROVINCES.map((province) => {
              const primary = locale === 'ne' ? province.ne : province.en;
              const secondary = locale === 'ne' ? province.en : province.ne;
              const note = locale === 'ne' ? province.noteNe : province.note;

              return (
                <li key={province.slug} className="reveal">
                  <Link
                    href={`/search?location_path=nepal.${province.slug}`}
                    className="group flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm border border-ink-100 transition-all hover:shadow-md hover:border-royal-300"
                  >
                    <span className="flex items-baseline gap-2.5">
                      <span className="text-lg font-bold tracking-[-0.025em] text-ink-900 group-hover:text-royal-600 transition-colors">
                        {primary}
                      </span>
                      <span
                        aria-hidden
                        className="text-sm font-medium text-ink-400 group-hover:text-royal-400 transition-colors"
                      >
                        {secondary}
                      </span>
                    </span>
                    <span className="mt-2 text-xs leading-relaxed font-medium text-ink-500 group-hover:text-ink-700 transition-colors">
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
