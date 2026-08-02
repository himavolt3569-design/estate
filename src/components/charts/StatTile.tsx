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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-ink-400">
          {Icon && <Icon aria-hidden className="size-3.5" />}
          <p className="label">{label}</p>
        </div>
        {href && (
          <ArrowRight
            aria-hidden
            className="size-3.5 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-crimson-600"
          />
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p
          className={cn(
            'text-4xl leading-none font-semibold tracking-tight',
            tone === 'pending' && 'text-ochre-700',
            tone === 'good' && Number(value) > 0 && 'text-emerald-700',
            (tone === 'flat' || (tone === 'good' && !Number(value))) && 'text-ink-900',
          )}
        >
          {shown}
          {suffix && <span className="ml-1 text-base font-normal text-ink-400">{suffix}</span>}
        </p>

        {trend && trend.length > 1 && (
          <Sparkline points={trend} color={trendColor} />
        )}
      </div>

      {delta != null && (
        <p
          className={cn(
            'mt-2.5 flex items-center gap-1.5 text-xs',
            rising ? 'text-emerald-700' : falling ? 'text-clay-700' : 'text-ink-500',
          )}
        >
          <DeltaIcon aria-hidden className="size-3.5" />
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
    'group relative block rounded-2xl border border-ink-100 bg-white p-5 shadow-soft transition-all';

  return href ? (
    <Link href={href} className={cn(className, 'hover:-translate-y-0.5 hover:shadow-raised')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
