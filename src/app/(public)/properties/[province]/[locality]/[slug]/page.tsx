import { ChevronRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Seal } from '@/components/brand/Seal';
import { TrustLedger } from '@/components/brand/TrustLedger';
import { MapLoader } from '@/components/map/MapLoader';
import { Avatar } from '@/components/media/Avatar';
import { PropertyImage } from '@/components/media/PropertyImage';
import { Badge, SectionHeading, Surface } from '@/components/ui/primitives';
import { LISTED_BY_LABELS } from '@/lib/auth/permissions';
import { formatArea, formatAreaSecondary, formatDate, formatPrice } from '@/lib/format';
import { absoluteUrl } from '@/lib/utils';
import { PresenceTracker } from '@/modules/analytics/components/PresenceTracker';
import { ContactPanel } from '@/modules/discovery/components/ContactPanel';
import { getPropertyBySlug } from '@/modules/discovery/queries';

// The SEO surface. ISR keeps it crawlable HTML and near-instant, while still
// picking up a price change within a minute.
export const revalidate = 60;

type Params = Promise<{ province: string; locality: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, province, locality } = await params;
  const property = await getPropertyBySlug(slug);

  if (!property) return { title: 'Property not found' };

  const price = formatPrice(property.price, { period: property.pricePeriod });
  const place = property.location?.nameEn ?? locality;
  const cover = property.images.find((i) => i.isCover) ?? property.images[0];
  const coverPath = cover?.renditions?.full ?? cover?.storagePath ?? null;

  return {
    title: `${property.title} · ${price}`,
    description: property.description.slice(0, 155),
    alternates: { canonical: `/properties/${province}/${locality}/${slug}` },
    openGraph: {
      title: `${property.title} in ${place}`,
      description: `${price} · ${place}, Nepal`,
      type: 'website',
      images: coverPath
        ? [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/property-media/${coverPath}`]
        : [],
    },
  };
}

export default async function PropertyPage({ params }: { params: Params }) {
  const { slug, province, locality } = await params;
  const property = await getPropertyBySlug(slug);

  if (!property) notFound();

  const cover = property.images.find((i) => i.isCover) ?? property.images[0];
  const rest = property.images.filter((i) => i.id !== cover?.id).slice(0, 4);
  const place = property.location?.nameEn ?? locality;

  // RealEstateListing structured data, so the listing can surface as a rich
  // result rather than a plain blue link.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.description,
    url: absoluteUrl(`/properties/${province}/${locality}/${slug}`),
    datePosted: property.publishedAt,
    identifier: property.referenceCode,
    offers: {
      '@type': 'Offer',
      price: property.price / 100,
      priceCurrency: 'NPR',
      availability: 'https://schema.org/InStock',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: property.lat,
      longitude: property.lng,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: place,
      addressRegion: province,
      addressCountry: 'NP',
    },
    ...(property.areaSqm
      ? { floorSize: { '@type': 'QuantitativeValue', value: property.areaSqm, unitCode: 'MTK' } }
      : {}),
    ...(property.bedrooms != null ? { numberOfBedrooms: property.bedrooms } : {}),
    ...(property.bathrooms != null ? { numberOfBathroomsTotal: property.bathrooms } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Serialised from our own typed object, never from user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Registers one view, deduped per visitor per day in the database. */}
      <PresenceTracker propertyId={property.id} />

      <div className="mx-auto max-w-8xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumb
          province={province}
          ancestors={property.location?.ancestors ?? []}
          current={property.title}
        />

        {/* Gallery: one large cover plus a strip. The lightbox is a client leaf
            loaded on interaction, not part of this page's bundle. */}
        <div className="mt-4 grid gap-2 overflow-hidden rounded-sm lg:grid-cols-[2fr_1fr]">
          <PropertyImage
            renditions={cover?.renditions}
            storagePath={cover?.storagePath}
            alt={cover?.alt ?? property.title}
            width={1200}
            height={900}
            sizes="(max-width: 1024px) 100vw, 66vw"
            priority
            wrapperClassName="w-full border border-ink-200"
          />
          {rest.length > 0 && (
            <div className="grid grid-cols-4 gap-2 lg:grid-cols-2">
              {rest.map((image) => (
                <PropertyImage
                  key={image.id}
                  renditions={image.renditions}
                  storagePath={image.storagePath}
                  alt={image.alt ?? property.title}
                  width={600}
                  height={450}
                  sizes="(max-width: 1024px) 25vw, 16vw"
                  wrapperClassName="w-full border border-ink-200"
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
          {/* ---------------- Main column ---------------- */}
          <div className="min-w-0 space-y-10">
            <header>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="royal">{TRANSACTION_LABEL[property.transactionType]}</Badge>
                <Badge>{SUBTYPE_LABEL[property.subtype] ?? property.subtype}</Badge>
                {property.verifiedAt && (
                  <Badge tone="verified">
                    <Seal size={12} /> Verified {formatDate(property.verifiedAt)}
                  </Badge>
                )}
              </div>

              <h1 className="mt-4 text-display-md text-ink-900">
                {property.title}
              </h1>

              <p className="mt-2 text-sm text-ink-500">
                {property.addressLine ? `${property.addressLine}, ` : ''}
                {place}
              </p>

              <p className="nums mt-6 text-4xl font-semibold tracking-[-0.035em] text-ink-900">
                {formatPrice(property.price, { period: property.pricePeriod })}
              </p>
              {property.priceNegotiable && (
                <p className="mt-1 text-xs text-ink-500">Price negotiable</p>
              )}
            </header>

            <KeyFacts property={property} />

            <section>
              <SectionHeading eyebrow="From the lister" title="About this property" />
              {/* Plain text rendered as text. No dangerouslySetInnerHTML anywhere
                  a user's words can reach. */}
              <p className="mt-4 text-base leading-relaxed whitespace-pre-line text-ink-700">
                {property.description}
              </p>
            </section>

            {property.features.length > 0 && (
              <section>
                <SectionHeading eyebrow="What it has" title="Features" />
                <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                  {property.features.map((feature) => (
                    <li key={feature.key} className="flex items-baseline gap-2 text-sm text-ink-700">
                      <span aria-hidden className="text-emerald-700">
                        ·
                      </span>
                      {feature.labelEn}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <SectionHeading
                eyebrow={
                  property.geomPrecision === 'approximate'
                    ? 'Approximate: the lister chose to show an area, not a point'
                    : 'Confirmed location'
                }
                title="Where it is"
              />
              <div className="mt-4 overflow-hidden rounded-sm border border-ink-200">
                <MapLoader
                  className="h-72 w-full"
                  center={{ lat: property.lat, lng: property.lng }}
                  approximate={property.geomPrecision === 'approximate'}
                  markers={
                    property.geomPrecision === 'approximate'
                      ? []
                      : [
                          {
                            id: property.id,
                            lat: property.lat,
                            lng: property.lng,
                            label: formatPrice(property.price, { period: property.pricePeriod }),
                            verified: Boolean(property.verifiedAt),
                          },
                        ]
                  }
                />
              </div>
            </section>

            {/* The signature element. */}
            <TrustLedger events={property.trustLedger as never} referenceCode={property.referenceCode} />
          </div>

          {/* ---------------- Sidebar ---------------- */}
          <aside className="lg:sticky lg:top-24">
            <Surface className="p-5">
              <p className="label">{LISTED_BY_LABELS[property.vendor?.role ?? 'property_owner']}</p>

              <div className="mt-3 flex items-center gap-3">
                <Avatar src={property.vendor?.avatarUrl} name={property.vendor?.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {property.vendor?.name ?? 'Lister'}
                  </p>
                  <p className="text-xs text-ink-500">
                    {property.vendor?.agency?.name ??
                      (property.vendor?.identityVerified ? 'Identity verified' : 'Identity not verified')}
                  </p>
                </div>
                {property.vendor?.identityVerified && <Seal size={18} className="ml-auto" />}
              </div>

              <div className="mt-5 border-t border-ink-200 pt-5">
                {/* The viewer is resolved inside the panel, on the client. This
                    route is ISR-cached for SEO, and reading the session here
                    would make every request dynamic to decide the visibility of
                    one button. */}
                <ContactPanel
                  propertyId={property.id}
                  available={property.contact}
                  propertyTitle={property.title}
                  ownerId={property.vendor?.id ?? null}
                />
              </div>
            </Surface>

            <Surface className="mt-4 p-5">
              <p className="label">Reference</p>
              <p className="nums mt-1 text-sm text-ink-700">{property.referenceCode}</p>
              <dl className="mt-4 space-y-2 border-t border-ink-200 pt-4 text-xs">
                <Row label="Listed" value={formatDate(property.publishedAt)} />
                <Row label="Views" value={property.viewCount.toLocaleString('en-IN')} />
                <Row label="Saved by" value={`${property.favoriteCount}`} />
              </dl>
            </Surface>
          </aside>
        </div>
      </div>
    </>
  );
}

const TRANSACTION_LABEL: Record<string, string> = {
  sale: 'For sale',
  rent: 'For rent',
  lease: 'For lease',
  short_stay: 'Short stay',
};

const SUBTYPE_LABEL: Record<string, string> = {
  house: 'House',
  apartment: 'Apartment',
  villa: 'Villa',
  condo: 'Condo',
  townhouse: 'Townhouse',
  studio: 'Studio',
  residential_land: 'Residential land',
  agricultural_land: 'Agricultural land',
  commercial_land: 'Commercial land',
  office: 'Office',
  shop: 'Shop',
  warehouse: 'Warehouse',
  factory: 'Factory',
};

function KeyFacts({ property }: { property: Awaited<ReturnType<typeof getPropertyBySlug>> }) {
  if (!property) return null;

  const facts: Array<{ label: string; value: string; sub?: string | null }> = [];

  if (property.areaSqm) {
    facts.push({
      label: 'Land area',
      value: formatArea(property.areaSqm, 'ropani'),
      sub: formatAreaSecondary(property.areaSqm),
    });
  }
  if (property.builtAreaSqm) {
    facts.push({
      label: 'Built area',
      value: formatArea(property.builtAreaSqm, 'sqft'),
    });
  }
  if (property.bedrooms != null) facts.push({ label: 'Bedrooms', value: String(property.bedrooms) });
  if (property.bathrooms != null) facts.push({ label: 'Bathrooms', value: String(property.bathrooms) });
  if (property.floors != null) facts.push({ label: 'Floors', value: String(property.floors) });
  if (property.parking != null) facts.push({ label: 'Parking', value: String(property.parking) });

  const roadAccess = property.attributes['road_access_ft'];
  if (typeof roadAccess === 'number') {
    facts.push({ label: 'Road access', value: `${roadAccess} ft` });
  }

  if (facts.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-ink-200 bg-ink-200 sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="bg-white p-4">
          <dt className="label">{fact.label}</dt>
          <dd className="nums mt-1.5 text-lg font-medium text-ink-900">{fact.value}</dd>
          {fact.sub && <dd className="nums mt-0.5 text-2xs text-ink-400">{fact.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="nums text-ink-700">{value}</dd>
    </div>
  );
}

function Breadcrumb({
  province,
  ancestors,
  current,
}: {
  province: string;
  ancestors: Array<{ nameEn: string; slug: string; level: string }>;
  current: string;
}) {
  const trail = ancestors.filter((a) => a.level !== 'country');

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-400">
        <li>
          <Link href="/search" className="hover:text-royal-700">
            Search
          </Link>
        </li>
        {trail.map((ancestor) => (
          <li key={ancestor.slug} className="flex items-center gap-1">
            <ChevronRight aria-hidden className="size-3" />
            <Link
              href={`/search?location_path=nepal.${province === ancestor.slug ? province : `${province}.${ancestor.slug}`}`}
              className="hover:text-royal-700"
            >
              {ancestor.nameEn}
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-1">
          <ChevronRight aria-hidden className="size-3" />
          <span className="line-clamp-1 text-ink-600">{current}</span>
        </li>
      </ol>
    </nav>
  );
}
