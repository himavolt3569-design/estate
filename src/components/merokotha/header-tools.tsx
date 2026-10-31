'use client';

import Link from 'next/link';
import { useState } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Ruler, Search, Wallet } from 'lucide-react';
import { useSiteLanguage } from './site-language';

export function HeaderTools({ compact = false }: { compact?: boolean }) {
  const { locale } = useSiteLanguage();
  return <Dropdown.Root><Dropdown.Trigger className={compact ? 'browse-nav__tools' : 'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-700 hover:bg-royal-50'}><span className={compact ? 'browse-nav__icon' : 'contents'}><Wallet aria-hidden className="size-4" /></span><span>{locale === 'ne' ? 'उपकरणहरू' : 'Tools'}</span>{!compact && <ChevronDown aria-hidden className="size-3.5" />}</Dropdown.Trigger><Dropdown.Portal><Dropdown.Content sideOffset={8} align="start" className="z-[100] min-w-48 rounded-xl border border-ink-100 bg-white p-1.5 shadow-xl"><Dropdown.Item asChild><Link href="/emi" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-ink-800 outline-none focus:bg-royal-50"><Wallet aria-hidden className="size-4 text-royal-700" />{locale === 'ne' ? 'किस्ता गणक' : 'EMI calculator'}</Link></Dropdown.Item><Dropdown.Item asChild><Link href="/land-size" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-ink-800 outline-none focus:bg-royal-50"><Ruler aria-hidden className="size-4 text-royal-700" />{locale === 'ne' ? 'जग्गाको क्षेत्रफल' : 'Land size converter'}</Link></Dropdown.Item></Dropdown.Content></Dropdown.Portal></Dropdown.Root>;
}

export function HeaderSearch() {
  const { locale } = useSiteLanguage();
  const [open, setOpen] = useState(false);
  const form = (mobile = false) => <form action="/#rentals" method="get" role="search" aria-label={mobile ? 'Search properties on mobile' : 'Search properties'} className="flex min-w-0 items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 pl-3 focus-within:border-royal-600"><input autoFocus={mobile || undefined} type="search" name="search" aria-label={locale === 'ne' ? 'घरजग्गा खोज्नुहोस्' : 'Search properties'} placeholder={locale === 'ne' ? 'ठाउँ वा घरजग्गा' : 'Search properties'} className="h-10 min-w-0 w-full bg-transparent text-xs text-ink-800 outline-none" /><button type="submit" aria-label="Submit property search" className="flex size-10 shrink-0 items-center justify-center text-royal-700"><Search aria-hidden className="size-4" /></button></form>;
  return <div className="relative min-w-0"><div className="hidden w-[clamp(140px,14vw,220px)] xl:block">{form()}</div><button type="button" className="flex size-10 items-center justify-center rounded-lg text-royal-700 hover:bg-royal-50 xl:hidden" aria-label="Open property search" aria-expanded={open} aria-controls="header-search-panel" onClick={() => setOpen(value => !value)}><Search aria-hidden className="size-5" /></button>{open && <div id="header-search-panel" className="absolute right-0 top-12 z-50 w-[min(310px,85vw)] rounded-xl border border-ink-100 bg-white p-3 shadow-xl xl:hidden">{form(true)}</div>}</div>;
}
