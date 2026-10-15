import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

import { Sparkline } from './TrendChart';

/**
 * A number, what it means, and which way it is going.
 *
 * The delta is the part that turns a figure into information: 128 views means
 * nothing on its own, "128, up 34 on the fortnight before" means something. It
 * is never colour alone — the arrow and the words carry it, and the colour only
 * agrees with them.
 */
export function StatTile({
  label,
  value,
  suffix,
  delta,
  deltaLabel,
  trend,
  trendColor,
  icon: Icon,
  href,
  tone = 'flat',
  hint,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  /** Change against the previous window of the same length. */
  delta?: number | null;
  deltaLabel?: string;
  trend?: number[];
  trendColor?: string;
  icon?: React.ElementType;
  href?: string;
  tone?: 'flat' | 'good' | 'pending';
  hint?: string;
}) {
  const shown = typeof value === 'number' ? value.toLocaleString('en-IN') : value;
  const rising = delta != null && delta > 0;
  const falling = delta != null && delta < 0;
  const DeltaIcon = rising ? TrendingUp : falling ? TrendingDown : Minus;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-ink-400">
          {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
          {/* The label is an uppercase micro-label at 11px; on a two-up phone
              grid it has to be allowed two lines rather than being clipped. */}
          <p className="label leading-[1.3]">{label}</p>
        </div>
        {href && (
          <ArrowRight
            aria-hidden
            className="size-3.5 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-crimson-600"
          />
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <p
          className={cn(
            'min-w-0 truncate text-3xl leading-none font-semibold tracking-tight sm:text-4xl',
            tone === 'pending' && 'text-ochre-700',
            tone === 'good' && Number(value) > 0 && 'text-emerald-700',
            (tone === 'flat' || (tone === 'good' && !Number(value))) && 'text-ink-900',
          )}
        >
          {shown}
          {suffix && <span className="ml-1 text-base font-normal text-ink-400">{suffix}</span>}
        </p>

        {/* The sparkline is supporting detail. At two tiles across a 375px
            screen there is no room for it beside the figure, and squeezing it
            in is what pushed these cards over their own width. */}
        {trend && trend.length > 1 && (
          <span className="hidden shrink-0 sm:block">
            <Sparkline points={trend} color={trendColor} />
          </span>
        )}
      </div>

      {delta != null && (
        <p
          className={cn(
            'mt-2.5 flex flex-wrap items-center gap-x-1.5 text-xs',
            rising ? 'text-emerald-700' : falling ? 'text-clay-700' : 'text-ink-500',
          )}
        >
          <DeltaIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="nums font-semibold">
            {rising ? '+' : ''}
            {delta.toLocaleString('en-IN')}
          </span>
          <span className="text-ink-500">{deltaLabel ?? 'vs the period before'}</span>
        </p>
      )}

      {hint && !delta && <p className="mt-2.5 text-xs text-ink-500">{hint}</p>}
    </>
  );

  const className =
    'group relative block rounded-2xl border border-ink-100 bg-white p-4 shadow-soft transition-all sm:p-5';

  return href ? (
    <Link href={href} className={cn(className, 'hover:-translate-y-0.5 hover:shadow-raised')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
