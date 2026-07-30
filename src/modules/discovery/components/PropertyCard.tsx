import Link from 'next/link';

import { TrustMark } from '@/components/brand/TrustLedger';
import { PropertyImage } from '@/components/media/PropertyImage';
import { Skeleton } from '@/components/ui/primitives';
import { getDictionary } from '@/i18n';
import { AREA_NOT_STATED } from '@/lib/format';
import { cn } from '@/lib/utils';

import type { PropertyCardDTO } from '../types';



/**
 * The card is a specimen sheet, not a SaaS tile.
 *
 * The facts are set as weight-contrast pairs: the figure in medium against its
 * unit in extra-light, which is the pairing the whole type system rests on and
 * scans faster than a row of icons. Hover darkens the rule to full ink and
 * brings up the corner registration ticks, so the card reads as being marked on
 * a drawing rather than lifting off the page. CSS only, no JavaScript.
 */
export async function PropertyCard({
  property,
  priority = false,
  className,
}: {
  property: PropertyCardDTO;
  priority?: boolean;
  className?: string;
}) {
  const t = await getDictionary();

  const transactionLabel: Record<PropertyCardDTO['transactionType'], string> = {
    sale: t.card.forSale,
    rent: t.card.forRent,
    lease: t.card.forLease,
    short_stay: t.card.shortStay,
  };

  const facts: Array<{ value: string; unit: string }> = [];

  if (property.bedrooms != null) {
    facts.push({
      value: String(property.bedrooms),
      unit: property.bedrooms === 1 ? t.card.bed : t.card.beds,
    });
  }
  if (property.bathrooms != null) {
    facts.push({
      value: String(property.bathrooms),
      unit: property.bathrooms === 1 ? t.card.bath : t.card.baths,
    });
  }
  if (property.areaDisplay !== AREA_NOT_STATED) {
    facts.push({ value: property.areaDisplay, unit: t.card.plot });
  }

  return (
    <article
      className={cn(
        'group relative border border-ink-200 bg-white',
        'transition-colors duration-200 hover:border-ink-900 focus-within:border-royal-700',
        className,
      )}
    >
      {/* Registration ticks, revealed on hover. The card is being marked up. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-px -left-px size-2 border-t border-l border-ink-900 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-px -bottom-px size-2 border-r border-b border-ink-900 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />

      <div className="relative overflow-hidden border-b border-ink-200">
        <PropertyImage
          renditions={property.cover?.renditions}
          alt={property.cover?.alt ?? property.title}
          width={800}
          height={600}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
          priority={priority}
          wrapperClassName="w-full"
          className="transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
        />
        <span className="absolute top-0 left-0 bg-royal-800 px-2.5 py-1 text-2xs font-medium tracking-[0.12em] text-white uppercase">
          {transactionLabel[property.transactionType]}
        </span>
      </div>

      <div className="p-4">
        <p className="label truncate">{property.locality}</p>

        <p className="nums mt-2 text-xl leading-none font-semibold tracking-[-0.03em] text-ink-900">
          {property.priceFormatted}
        </p>

        <h3 className="mt-2 line-clamp-2 text-sm leading-snug text-ink-600">
          {/* The link carries the accessible name; the overlay makes the whole
              card a pointer target without nesting interactive elements. */}
          <Link href={property.href} prefetch className="after:absolute after:inset-0">
            {property.title}
          </Link>
        </h3>

        {facts.length > 0 && (
          <dl className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-ink-100 pt-3">
            {facts.map((fact) => (
              <div key={fact.unit} className="flex items-baseline gap-1.5">
                <dd className="nums text-sm font-medium text-ink-900">{fact.value}</dd>
                <dt className="text-2xs font-extralight tracking-wide text-ink-400">{fact.unit}</dt>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-2xs text-ink-400">{property.listedByLabel}</span>
          <div className="flex items-center gap-2.5">
            {property.distanceLabel && (
              <span className="nums text-2xs text-ink-400">{property.distanceLabel}</span>
            )}
            <TrustMark verified={property.verified} label={t.card.checked} />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Matches the card's real dimensions so nothing shifts when content arrives. */
export function PropertyCardSkeleton() {
  return (
    <div className="border border-ink-200 bg-white">
      <Skeleton className="aspect-4/3 w-full rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-4 pt-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export function PropertyCardGrid({
  properties,
  priorityCount = 4,
}: {
  properties: PropertyCardDTO[];
  priorityCount?: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {properties.map((property, index) => (
        <PropertyCard key={property.id} property={property} priority={index < priorityCount} />
      ))}
    </div>
  );
}
