import Link from 'next/link';

import { cn } from '@/lib/utils';

/** The frame every chart sits in, so a dashboard reads as one surface. */
export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Series key. Present whenever more than one colour is on screen. */
  legend?: Array<{ label: string; color: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-6',
        className,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-ink-500">{subtitle}</p>}
        </div>

        {legend && legend.length > 0 && (
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {legend.map((entry) => (
              <li key={entry.label} className="flex items-center gap-1.5 text-xs text-ink-600">
                <span
                  aria-hidden
                  className="h-0.5 w-3.5 rounded-full"
                  style={{ background: entry.color }}
                />
                {entry.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {children}
    </section>
  );
}

/**
 * The range presets, in one row above everything they scope.
 *
 * Links rather than client state: the page is server-rendered from the range,
 * so the numbers, the charts and the URL can never disagree, and a seller can
 * bookmark "last 90 days".
 */
export function RangeTabs({
  current,
  basePath,
  options = [7, 30, 90],
}: {
  current: number;
  basePath: string;
  options?: number[];
}) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="inline-flex rounded-full border border-ink-200 bg-white p-0.5 shadow-sm"
    >
      {options.map((days) => {
        const selected = days === current;
        return (
          <Link
            key={days}
            href={`${basePath}?days=${days}`}
            scroll={false}
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              selected
                ? 'bg-royal-800 text-white shadow-sm'
                : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
            )}
          >
            {days} days
          </Link>
        );
      })}
    </div>
  );
}
