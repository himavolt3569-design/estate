'use client';

import { Languages } from 'lucide-react';
import * as React from 'react';

import { setLocale } from '@/i18n/actions';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  current,
  className,
}: {
  current: Locale;
  className?: string;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="group"
      aria-label="Language / भाषा"
    >
      <Languages aria-hidden className="size-3.5 shrink-0 text-ink-400" />
      <div className="flex border border-ink-200">
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <button
              key={locale}
              type="button"
              lang={locale}
              aria-pressed={active}
              disabled={pending || active}
              onClick={() => startTransition(() => void setLocale(locale))}
              className={cn(
                'px-2.5 py-1 text-2xs font-medium transition-colors',
                active
                  ? 'bg-royal-800 text-white'
                  : 'bg-white text-ink-500 hover:bg-ink-50 hover:text-ink-900',
                pending && 'opacity-60',
              )}
            >
              {LOCALE_LABELS[locale]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
