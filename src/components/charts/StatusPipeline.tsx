'use client';

import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/utils';

export type PipelineSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
  href?: string;
  /** Plain sentence shown under the legend when this segment is hovered. */
  note?: string;
};

/**
 * Where every property stands, as one bar.
 *
 * A pie was the obvious choice and the wrong one: four slices means judging
 * four angles, and the question here is really "how much of my portfolio is
 * actually live" — a length comparison. Lengths against a shared baseline is
 * the one comparison people read accurately.
 *
 * Identity never rests on colour alone. Every segment is named and counted in
 * the legend below, hovering either one lights up the other, and each row is a
 * link to that slice of the list.
 */
export function StatusPipeline({
  segments,
  total,
  emptyMessage = 'Nothing listed yet',
}: {
  segments: PipelineSegment[];
  total: number;
  emptyMessage?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const shown = segments.filter((segment) => segment.value > 0);

  if (total === 0 || shown.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {/* The 2px gaps are the surface doing the separating — no strokes around
          the segments, which would add ink that is not data. */}
      <div className="flex h-11 w-full gap-0.5 overflow-hidden rounded-lg bg-white">
        {shown.map((segment) => {
          const share = (segment.value / total) * 100;
          const wide = share > 12;

          return (
            <div
              key={segment.key}
              onPointerEnter={() => setActive(segment.key)}
              onPointerLeave={() => setActive(null)}
              style={{ width: `${share}%`, background: segment.color }}
              className={cn(
                'relative flex items-center justify-center rounded-[3px] transition-opacity duration-150',
                active && active !== segment.key ? 'opacity-45' : 'opacity-100',
              )}
              title={`${segment.label}: ${segment.value}`}
            >
              {/* Only labelled inside when the text genuinely fits; otherwise the
                  legend below carries it rather than clipping it here. */}
              {wide && (
                <span className="nums px-1 text-xs font-semibold text-white">
                  {segment.value.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <ul className="mt-4 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
        {segments.map((segment) => {
          const row = (
            <>
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: segment.color }}
              />
              <span className="flex-1 truncate text-ink-700">{segment.label}</span>
              <span className="nums font-semibold text-ink-900">
                {segment.value.toLocaleString('en-IN')}
              </span>
              <span className="nums w-10 text-right text-xs text-ink-400">
                {total === 0 ? '0%' : `${Math.round((segment.value / total) * 100)}%`}
              </span>
            </>
          );

          const className = cn(
            'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
            active === segment.key ? 'bg-ink-50' : 'bg-transparent',
            segment.value === 0 && 'opacity-55',
          );

          return (
            <li
              key={segment.key}
              onPointerEnter={() => setActive(segment.key)}
              onPointerLeave={() => setActive(null)}
            >
              {segment.href && segment.value > 0 ? (
                <Link
                  href={segment.href}
                  className={cn(className, 'hover:bg-ink-50 focus-visible:bg-ink-50')}
                  onFocus={() => setActive(segment.key)}
                  onBlur={() => setActive(null)}
                >
                  {row}
                </Link>
              ) : (
                <div className={className}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>

      {active && segments.find((segment) => segment.key === active)?.note && (
        <p className="mt-3 border-l-2 border-ink-200 pl-3 text-xs leading-relaxed text-ink-500">
          {segments.find((segment) => segment.key === active)!.note}
        </p>
      )}
    </div>
  );
}
