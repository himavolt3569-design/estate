'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Building2, ChevronDown, Home, LandPlot, Ruler, Store, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

/**
 * Three things, not seven.
 *
 * Buy, Rent, Land and Shops are all the same question — what kind of property —
 * so they collapse into one menu. The two tools sit beside it as their own
 * stops, because someone works out a monthly payment or converts ropani to
 * bigha as a task in itself, not as a step inside browsing.
 *
 * Every label is one or two short words with the Nepali underneath, because
 * "EMI calculator" and "Land size calculator" are the kind of phrases that make
 * a person decide a site is not meant for them.
 */

const PROPERTY_LINKS = [
  { href: '/search?transaction_type=sale', label: 'Buy', ne: 'किन्ने', icon: Home },
  { href: '/search?transaction_type=rent', label: 'Rent', ne: 'भाडामा', icon: Building2 },
  { href: '/search?category=land', label: 'Land', ne: 'जग्गा', icon: LandPlot },
  { href: '/search?category=commercial', label: 'Shops and offices', ne: 'पसल र अफिस', icon: Store },
];

const TOOLS = [
  { href: '/emi', label: 'EMI', ne: 'किस्ता', icon: Wallet },
  { href: '/land-size', label: 'Land size', ne: 'नाप', icon: Ruler },
];

export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden flex-1 items-center gap-1 lg:flex">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition-colors',
            'hover:bg-crimson-50 hover:text-crimson-700 data-[state=open]:bg-crimson-50 data-[state=open]:text-crimson-700',
          )}
        >
          Property
          <ChevronDown
            aria-hidden
            className="size-3.5 text-ink-400 transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={8}
            className="z-100 w-64 overflow-hidden rounded-xl border border-ink-100 bg-white p-1.5 shadow-floating"
          >
            {PROPERTY_LINKS.map((item) => (
              <DropdownMenu.Item key={item.href} asChild>
                <Link
                  href={item.href}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none data-highlighted:bg-crimson-50"
                >
                  <item.icon aria-hidden className="size-4 shrink-0 text-crimson-600" />
                  <span className="min-w-0">
                    <span className="block font-medium text-ink-900">{item.label}</span>
                    <span aria-hidden className="block text-xs text-ink-400">
                      {item.ne}
                    </span>
                  </span>
                </Link>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {TOOLS.map((tool) => (
        <Link
          key={tool.href}
          href={tool.href}
          prefetch
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            pathname === tool.href
              ? 'bg-crimson-50 text-crimson-700'
              : 'text-ink-700 hover:bg-crimson-50 hover:text-crimson-700',
          )}
        >
          <tool.icon aria-hidden className="size-4 text-ink-400" />
          {tool.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The phone version.
 *
 * A scrolling row of icon tiles rather than a burger menu: on a 360px screen
 * these are the six places anyone actually goes, and hiding them behind a tap
 * costs more than the space it saves. The Nepali sits under each one, which is
 * what makes the row readable to someone who skims past the English.
 */
export function MobileNav() {
  const items = [...PROPERTY_LINKS, ...TOOLS];

  return (
    <nav
      aria-label="Browse"
      className="flex gap-2 overflow-x-auto border-t border-ink-100 px-4 py-2.5 [scrollbar-width:none] sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex min-w-[4.5rem] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors active:bg-crimson-50"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-crimson-50 text-crimson-600">
            <item.icon aria-hidden className="size-4.5" />
          </span>
          <span className="text-[11px] leading-tight font-medium text-ink-800">{item.label}</span>
          <span aria-hidden className="text-[10px] leading-none text-ink-400">
            {item.ne}
          </span>
        </Link>
      ))}
    </nav>
  );
}
