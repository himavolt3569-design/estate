'use client';

import { MapPin, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { SelectMenu } from '@/components/ui/select-menu';
import { cn } from '@/lib/utils';

/**
 * The floating bar under the hero.
 *
 * The layout is unchanged. Two things about it were not working: the four
 * controls sat in no form at all, so Search did nothing on click, and the three
 * dropdowns were native <select>s whose open list the browser draws itself —
 * square, OS-blue, and nothing like the rest of the page.
 */

const TYPES = [
  { value: '', label: 'Any type' },
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'residential_land', label: 'Land' },
  { value: 'shop', label: 'Shop or office' },
];

/** Rupees, as a Nepali buyer says them. Values are paisa, which is what the filter takes. */
const PRICES = [
  { value: '2500000', label: '25 lakh' },
  { value: '5000000', label: '50 lakh' },
  { value: '10000000', label: '1 crore' },
  { value: '20000000', label: '2 crore' },
  { value: '50000000', label: '5 crore' },
  { value: '100000000', label: '10 crore' },
];

const toPaisa = (rupees: string) => (rupees ? String(Number(rupees) * 100) : '');

export function HeroSearch() {
  const router = useRouter();
  const [transaction, setTransaction] = useState<'sale' | 'rent'>('sale');
  const [place, setPlace] = useState('');
  const [type, setType] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const params = new URLSearchParams();
    params.set('transaction_type', transaction);
    if (place.trim()) params.set('q', place.trim());
    if (type) params.set('subtype', type);
    if (min) params.set('price_min', toPaisa(min));
    if (max) params.set('price_max', toPaisa(max));

    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className="rounded-2xl bg-white p-4 shadow-floating lg:p-6"
    >
      <div className="mb-5 flex items-center gap-4 border-b border-ink-100 pb-1 sm:mb-6 sm:gap-6 sm:pb-2">
        {(['sale', 'rent'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTransaction(option)}
            aria-pressed={transaction === option}
            className={cn(
              'min-h-11 px-3 pb-2 text-base transition-colors sm:text-sm',
              transaction === option
                ? 'border-b-2 border-crimson-600 font-semibold text-crimson-700'
                : 'font-medium text-ink-500 hover:text-ink-900',
            )}
          >
            {option === 'sale' ? 'Buy' : 'Rent'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <label htmlFor="hero-place" className="mb-1 block text-sm font-medium text-ink-700">
            Location
          </label>
          <div className="relative">
            <input
              id="hero-place"
              type="text"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              placeholder="Enter location"
              className="h-12 w-full rounded-lg border border-ink-200 py-2.5 pr-10 pl-3.5 text-sm shadow-sm transition-colors hover:border-ink-300 focus:border-royal-500 focus:ring-2 focus:ring-royal-500/20 focus:outline-none"
            />
            <MapPin
              aria-hidden
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400"
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <label htmlFor="hero-type" className="mb-1 block text-sm font-medium text-ink-700">
            Property Type
          </label>
          <SelectMenu
            id="hero-type"
            value={type}
            onValueChange={setType}
            options={TYPES}
            placeholder="Select type"
          />
        </div>

        <div className="lg:col-span-1">
          <label htmlFor="hero-min" className="mb-1 block text-sm font-medium text-ink-700">
            Min Price
          </label>
          <SelectMenu
            id="hero-min"
            value={min}
            onValueChange={setMin}
            placeholder="Min price"
            options={[{ value: '', label: 'No minimum' }, ...PRICES]}
          />
        </div>

        <div className="lg:col-span-1">
          <label htmlFor="hero-max" className="mb-1 block text-sm font-medium text-ink-700">
            Max Price
          </label>
          <SelectMenu
            id="hero-max"
            value={max}
            onValueChange={setMax}
            placeholder="Max price"
            options={[{ value: '', label: 'No maximum' }, ...PRICES]}
          />
        </div>

        <div className="lg:col-span-1">
          <Button type="submit" size="lg" className="h-12 w-full">
            <Search aria-hidden className="mr-2 size-4" /> Search
          </Button>
        </div>
      </div>
    </form>
  );
}
