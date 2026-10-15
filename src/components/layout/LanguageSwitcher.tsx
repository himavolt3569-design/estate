'use client';

import { Languages } from 'lucide-react';
import * as React from 'react';
import { useRouter } from 'next/navigation';

import { setLocale } from '@/i18n/actions';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  current,
  className,
  onChange,
  compact = false,
}: {
  current: Locale;
  className?: string;
  onChange?: (locale: Locale) => void;
  compact?: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();

  return (
    <div
      className={cn('flex items-center gap-1.5', className)}
      role="group"
      aria-label="Language / भाषा"
    >
      {!compact && <Languages aria-hidden className="size-3.5 shrink-0 text-ink-400" />}
      <div className="flex overflow-hidden rounded-md border border-ink-200">
        {LOCALES.map((locale) => {
          const active = locale === current;
          return (
            <button
              key={locale}
              type="button"
              lang={locale}
              aria-label={LOCALE_LABELS[locale]}
              aria-pressed={active}
              disabled={pending || active}
              onClick={() => {
                onChange?.(locale);
                startTransition(async () => {
                  try { await setLocale(locale); router.refresh(); }
                  catch { onChange?.(current); }
                });
              }}
              className={cn(
                compact ? 'px-1.5 py-1.5 text-[11px] font-semibold transition-colors' : 'px-2.5 py-1 text-2xs font-medium transition-colors',
                active
                  ? 'bg-royal-800 text-white'
                  : 'bg-white text-ink-500 hover:bg-ink-50 hover:text-ink-900',
                pending && 'opacity-60',
              )}
            >
              {compact ? locale === 'en' ? 'EN' : 'ने' : LOCALE_LABELS[locale]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
