import { SlidersHorizontal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import {
  PropertyCardGrid,
  PropertyCardSkeleton,
} from '@/modules/discovery/components/PropertyCard';
import { countProperties, searchProperties } from '@/modules/discovery/queries';
import type { SearchFilters } from '@/modules/discovery/types';

export const metadata: Metadata = {
  title: 'Search property',
  description: 'Search houses, apartments, land and commercial property across Nepal.',
};

// Authenticated-independent but filter-dependent: rendered per request.
export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function one(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function num(params: SearchParams, key: string): number | undefined {
  const raw = one(params, key);
  if (raw == null || raw === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The URL is the source of truth for search state. That makes every search
 * shareable, correct under the back button, and server-renderable, which is
 * what lets the first paint be HTML rather than a spinner waiting on fetch.
 */
function parseFilters(params: SearchParams): SearchFilters {
  const category = one(params, 'category');
  const transaction = one(params, 'transaction_type');
  const sort = one(params, 'sort');

  const filters: SearchFilters = {};

  const q = one(params, 'q');
  if (q) filters.q = q;

  if (category === 'residential' || category === 'land' || category === 'commercial') {
    filters.category = category;
  }
  if (
    transaction === 'sale' ||
    transaction === 'rent' ||
    transaction === 'lease' ||
    transaction === 'short_stay'
  ) {
    filters.transaction_type = transaction;
  }
  if (sort === 'price_asc' || sort === 'price_desc' || sort === 'distance' || sort === 'newest') {
    filters.sort = sort;
  }

  const priceMin = num(params, 'price_min');
  const priceMax = num(params, 'price_max');
  if (priceMin != null) filters.price_min = priceMin;
  if (priceMax != null) filters.price_max = priceMax;

  const beds = num(params, 'bedrooms_min');
  if (beds != null) filters.bedrooms_min = beds;

  const locationPath = one(params, 'location_path');
  if (locationPath && /^[a-z0-9_.]+$/.test(locationPath)) filters.location_path = locationPath;

  if (one(params, 'verified_only') === 'true') filters.verified_only = true;

  // "Nearby" search. Coordinates come from the browser's geolocation prompt and
  // are echoed into the URL by the client, so a nearby search is shareable too.
  const lat = num(params, 'lat');
  const lng = num(params, 'lng');
  const radius = num(params, 'radius_m');
  if (lat != null && lng != null) {
    filters.lat = lat;
    filters.lng = lng;
    filters.radius_m = radius ?? 5000;
    filters.sort ??= 'distance';
  }

  return filters;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  return (
    <div className="mx-auto max-w-8xl px-4 py-8 sm:px-6 lg:px-8">
      <FilterBar params={params} filters={filters} />

      {/* The filter bar paints immediately; results stream into this boundary.
          Perceived response is instant even when the geo query takes 300ms. */}
      <Suspense key={JSON.stringify(params)} fallback={<ResultsSkeleton />}>
        <Results filters={filters} params={params} />
      </Suspense>
    </div>
  );
}

async function Results({
  filters,
  params,
}: {
  filters: SearchFilters;
  params: SearchParams;
}) {
  const cursor = one(params, 'cursor');

  const [{ items, nextCursor }, total] = await Promise.all([
    searchProperties(filters, cursor),
    countProperties(filters),
  ]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No properties match these filters"
        description="Widening the price range or the search radius usually helps. You can also clear the filters and start again."
        action={
          <Button asChild variant="secondary">
            <Link href="/search">Clear all filters</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <p className="nums mb-5 text-sm text-ink-500">
        {total >= 1000 ? '1,000+' : total.toLocaleString('en-IN')}{' '}
        {total === 1 ? 'property' : 'properties'}
      </p>

      <PropertyCardGrid properties={items} />

      {nextCursor && (
        <div className="mt-10 flex justify-center">
          <Button asChild variant="secondary">
            {/* Keyset pagination: the cursor is a position, not an offset, so
                page 400 costs exactly what page 1 costs.

                The existing params are carried through, because a "next page" link that
                only sets the cursor silently drops every active filter and
                paginates a different result set than the one on screen. */}
            <Link href={`/search?${buildNextHref(params, nextCursor)}`}>Load more</Link>
          </Button>
        </div>
      )}
    </>
  );
}

/** Preserves every active filter and replaces only the cursor. */
function buildNextHref(params: SearchParams, cursor: string): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === 'cursor' || value == null) continue;
    if (Array.isArray(value)) {
      const first = value[0];
      if (first) next.set(key, first);
    } else {
      next.set(key, value);
    }
  }

  next.set('cursor', cursor);
  return next.toString();
}

function ResultsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Filter bar: a plain GET form, so it works before JavaScript loads            */
/* -------------------------------------------------------------------------- */
function FilterBar({ params, filters }: { params: SearchParams; filters: SearchFilters }) {
  const activeCount = Object.keys(filters).filter((k) => k !== 'sort').length;

  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="mb-6 rounded-sm border border-ink-200 bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor="q" className="label mb-1.5 block">
            Keyword
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={one(params, 'q') ?? ''}
            placeholder="Area, landmark, building"
            className="h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm placeholder:text-ink-300 focus-visible:border-royal-500 focus-visible:outline-none"
          />
        </div>

        <Select
          id="transaction_type"
          label="Looking to"
          defaultValue={one(params, 'transaction_type')}
          options={[
            { value: '', label: 'Any' },
            { value: 'sale', label: 'Buy' },
            { value: 'rent', label: 'Rent' },
            { value: 'lease', label: 'Lease' },
            { value: 'short_stay', label: 'Short stay' },
          ]}
        />

        <Select
          id="category"
          label="Type"
          defaultValue={one(params, 'category')}
          options={[
            { value: '', label: 'Any' },
            { value: 'residential', label: 'Residential' },
            { value: 'land', label: 'Land' },
            { value: 'commercial', label: 'Commercial' },
          ]}
        />

        <Select
          id="sort"
          label="Sort"
          defaultValue={one(params, 'sort')}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'price_asc', label: 'Price: low to high' },
            { value: 'price_desc', label: 'Price: high to low' },
            { value: 'distance', label: 'Nearest' },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-4">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <SlidersHorizontal aria-hidden className="size-3.5" />
          {activeCount > 0 ? (
            <span>
              {activeCount} {activeCount === 1 ? 'filter' : 'filters'} applied
            </span>
          ) : (
            <span>No filters applied</span>
          )}
        </div>
        <div className="flex gap-2">
          {activeCount > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/search">Clear</Link>
            </Button>
          )}
          <Button type="submit" size="sm">
            Apply filters
          </Button>
        </div>
      </div>
    </form>
  );
}

function Select({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="label mb-1.5 block">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue ?? ''}
        className="h-11 w-full rounded-sm border border-ink-200 bg-white px-3 text-sm text-ink-800 focus-visible:border-royal-500 focus-visible:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
