import { Bed, Bath, Square, MapPin, Heart } from 'lucide-react';
import Link from 'next/link';

import { PropertyImage } from '@/components/media/PropertyImage';
import { Skeleton } from '@/components/ui/primitives';

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
export function PropertyCard({
  property,
  priority = false,
  className,
}: {
  property: PropertyCardDTO;
  priority?: boolean;
  className?: string;
}) {
  const transactionLabel: Record<PropertyCardDTO['transactionType'], string> = {
    sale: 'For Sale',
    rent: 'For Rent',
    lease: 'For Lease',
    short_stay: 'Short Stay',
  };

  const facts: Array<{ value: string; unit: string }> = [];

  if (property.bedrooms != null) {
    facts.push({
      value: String(property.bedrooms),
      unit: property.bedrooms === 1 ? 'Bed' : 'Beds',
    });
  }
  if (property.bathrooms != null) {
    facts.push({
      value: String(property.bathrooms),
      unit: property.bathrooms === 1 ? 'Bath' : 'Baths',
    });
  }
  if (property.areaDisplay !== AREA_NOT_STATED) {
    facts.push({ value: property.areaDisplay, unit: 'Plot' });
  }

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border border-ink-100 bg-white shadow-sm overflow-hidden',
        'transition-all duration-300 hover:shadow-md hover:-translate-y-1',
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <PropertyImage
          renditions={property.cover?.renditions}
          storagePath={property.cover?.storagePath}
          alt={property.cover?.alt ?? property.title}
          width={800}
          height={600}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
          priority={priority}
          wrapperClassName="h-full w-full"
          className="h-full w-full object-cover transition-transform duration-[600ms] group-hover:scale-[1.04]"
        />
        
        {/* Badges */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          <span className="rounded bg-royal-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            {transactionLabel[property.transactionType]}
          </span>
          <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/40">
            <Heart className="h-4 w-4 text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="line-clamp-1 text-lg font-bold text-ink-900">
          <Link href={property.href} prefetch className="after:absolute after:inset-0">
            {property.title}
          </Link>
        </h3>
        
        <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{property.locality}</span>
        </div>

        <p className="nums mt-3 text-xl font-bold text-royal-600">
          {property.priceFormatted}
          {property.transactionType === 'rent' && <span className="text-sm font-normal text-ink-500"> / month</span>}
        </p>

        {facts.length > 0 && (
          <div className="mt-auto pt-4 border-t border-ink-100 flex items-center gap-4 text-sm text-ink-600">
            {property.bedrooms != null && (
              <div className="flex items-center gap-1.5">
                <Bed className="h-4 w-4 shrink-0 text-ink-400" />
                <span><span className="font-medium text-ink-900">{property.bedrooms}</span> {property.bedrooms === 1 ? 'Bed' : 'Beds'}</span>
              </div>
            )}
            {property.bathrooms != null && (
              <div className="flex items-center gap-1.5">
                <Bath className="h-4 w-4 shrink-0 text-ink-400" />
                <span><span className="font-medium text-ink-900">{property.bathrooms}</span> {property.bathrooms === 1 ? 'Bath' : 'Baths'}</span>
              </div>
            )}
            {property.areaDisplay !== AREA_NOT_STATED && (
              <div className="flex items-center gap-1.5">
                <Square className="h-4 w-4 shrink-0 text-ink-400" />
                <span><span className="font-medium text-ink-900">{property.areaDisplay}</span></span>
              </div>
            )}
          </div>
        )}
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
