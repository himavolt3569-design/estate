import Link from 'next/link';

import { cn } from '@/lib/utils';

export type RankedRow = {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  href?: string;
};

/**
 * Which listings are actually working, longest bar first.
 *
 * Horizontal because listing titles are long: as columns the labels would have
 * to rotate, and rotated text is read at about half the speed of flat text.
 * One hue — the bars are the same measure, so a second colour would encode
 * nothing. The value rides the tip of each bar, so nothing here needs a hover
 * to be readable.
 */
export function RankedBars({
  rows,
  valueLabel,
  color,
  emptyMessage = 'Nothing to rank yet',
}: {
  rows: RankedRow[];
  valueLabel: string;
  color: string;
  emptyMessage?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  const ranked = rows.filter((row) => row.value > 0);

  if (ranked.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ol className="space-y-3.5">
      {ranked.map((row) => {
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-ink-800 group-hover:text-crimson-700">
                {row.label}
              </span>
              <span className="nums shrink-0 text-sm font-semibold text-ink-900">
                {row.value.toLocaleString('en-IN')}
                <span className="ml-1 text-xs font-normal text-ink-400">{valueLabel}</span>
              </span>
            </div>

            {/* 8px track, 4px rounded end, grown from a shared baseline. */}
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(3, (row.value / max) * 100)}%`, background: color }}
              />
            </div>

            {row.sublabel && (
              <p className="nums mt-1 truncate text-xs text-ink-400">{row.sublabel}</p>
            )}
          </>
        );

        return (
          <li key={row.id}>
            {row.href ? (
              <Link href={row.href} className={cn('group block')}>
                {content}
              </Link>
            ) : (
              <div className="group">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
