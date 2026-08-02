'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { AREA_FILL_OPACITY, CHART, dayLabel, dayLabelLong, niceScale, tick } from './tokens';

export type TrendPoint = { date: string; value: number };

/**
 * One measure over time — views per day, enquiries per day, new accounts per
 * week.
 *
 * Deliberately one series per chart. Views run in the hundreds and enquiries in
 * the ones, so putting both on the same picture needs two y-axes, and a
 * two-axis chart lets you draw any relationship you like by choosing the
 * scales. Two charts side by side say the same thing and cannot lie.
 *
 * The SVG is drawn at the container's real pixel width rather than scaled from
 * a fixed viewBox, because a scaled viewBox shrinks the axis text with it — at
 * 340px on a phone the labels end up around 6px and unreadable.
 */
export function TrendChart({
  points,
  label,
  color = CHART.views,
  variant = 'area',
  height = 190,
  emptyMessage = 'Nothing recorded yet',
  className,
}: {
  points: TrendPoint[];
  label: string;
  color?: string;
  variant?: 'area' | 'column';
  height?: number;
  emptyMessage?: string;
  className?: string;
}) {
  const [box, ref] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Until the container has been measured the chart is drawn into a viewBox at
  // a sensible default and scaled to fit, so a chart is never a narrow stub in
  // a wide card — including for anyone whose JavaScript never arrives.
  const measured = box > 0;
  const width = measured ? box : 640;
  const pad = { top: 16, right: 14, bottom: 26, left: 44 };
  const plotWidth = Math.max(1, width - pad.left - pad.right);
  const plotHeight = Math.max(1, height - pad.top - pad.bottom);

  const values = points.map((point) => point.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const scale = niceScale(Math.max(...values, 0));

  /** Columns share the band; the cap keeps a 7-day view from drawing slabs. */
  const band = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.min(24, Math.max(3, band - 2));

  /*
   * A line is sampled at instants and sits on the edges of the plot; a column
   * occupies a day and sits in the middle of its band. Using the line's
   * positions for columns pushes half of the first bar out over the axis.
   */
  const x = (index: number) =>
    variant === 'column'
      ? pad.left + (index + 0.5) * band
      : points.length === 1
        ? pad.left + plotWidth / 2
        : pad.left + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => pad.top + plotHeight - (value / scale.max) * plotHeight;

  const peak = values.reduce((best, value, index) => (value > values[best]! ? index : best), 0);

  const pointAt = useCallback(
    (clientX: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || points.length === 0) return null;

      // Screen pixels back into the chart's own units. The two are the same
      // once the container has been measured, and are not before that.
      const scaleX = rect.width === 0 ? 1 : width / rect.width;
      const offset = (clientX - rect.left) * scaleX - pad.left;
      const index =
        variant === 'column'
          ? Math.floor(offset / band)
          : Math.round((plotWidth === 0 ? 0 : offset / plotWidth) * (points.length - 1));

      return Math.min(points.length - 1, Math.max(0, index));
    },
    [band, pad.left, plotWidth, points.length, variant, width],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setActive((current) => {
      const start = current ?? points.length - 1;
      const next = event.key === 'ArrowLeft' ? start - 1 : start + 1;
      return Math.min(points.length - 1, Math.max(0, next));
    });
  }

  if (points.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center text-sm text-ink-400', className)}
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${x(points.length - 1).toFixed(1)} ${pad.top + plotHeight} L${x(0).toFixed(1)} ${pad.top + plotHeight} Z`;

  // First, middle and last only. Every date across 30 days collides on a phone.
  const axisIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
    (value, index, list) => list.indexOf(value) === index,
  );

  const hovered = active == null ? null : points[active];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <svg
        ref={svgRef}
        width={measured ? width : '100%'}
        height={height}
        // Left at the default xMidYMid meet: the fallback scales uniformly, so
        // the type never stretches on the way to being measured.
        viewBox={measured ? undefined : `0 0 ${width} ${height}`}
        role="img"
        tabIndex={0}
        aria-label={`${label}. ${total.toLocaleString('en-IN')} in total across ${points.length} ${points.length === 1 ? 'day' : 'days'}. Use the left and right arrow keys to read each value.`}
        className="touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-royal-500/30"
        onPointerMove={(event) => setActive(pointAt(event.clientX))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        {/* Gridlines: hairline, solid, one step off the surface. */}
        {scale.values.map((value) => (
          <g key={value}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(value)}
              y2={y(value)}
              stroke={value === 0 ? CHART.axis : CHART.grid}
              strokeWidth={1}
            />
            <text
              x={pad.left - 8}
              y={y(value) + 4}
              textAnchor="end"
              fontSize={11}
              fill={CHART.muted}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {tick(value)}
            </text>
          </g>
        ))}

        {axisIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={height - 8}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            fontSize={11}
            fill={CHART.muted}
          >
            {dayLabel(points[index]!.date)}
          </text>
        ))}

        {total === 0 ? (
          <text
            x={pad.left + plotWidth / 2}
            y={pad.top + plotHeight / 2}
            textAnchor="middle"
            fontSize={13}
            fill={CHART.muted}
          >
            {emptyMessage}
          </text>
        ) : variant === 'area' ? (
          <>
            <path d={areaPath} fill={color} fillOpacity={AREA_FILL_OPACITY} />
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* The end dot carries a surface ring so it stays legible where it
                crosses the line or the gridline behind it. */}
            <circle
              cx={x(points.length - 1)}
              cy={y(points.at(-1)!.value)}
              r={4}
              fill={color}
              stroke={CHART.surface}
              strokeWidth={2}
            />
          </>
        ) : (
          points.map((point, index) =>
            point.value === 0 ? null : (
              <rect
                key={point.date}
                x={x(index) - barWidth / 2}
                y={y(point.value)}
                width={barWidth}
                height={Math.max(2, pad.top + plotHeight - y(point.value))}
                rx={Math.min(4, barWidth / 2)}
                fill={color}
                opacity={active == null || active === index ? 1 : 0.55}
              />
            ),
          )
        )}

        {/* One direct label, on the peak. A number on every point is chaos. */}
        {total > 0 && values[peak]! > 0 && (
          <text
            x={x(peak)}
            y={Math.max(12, y(values[peak]!) - 10)}
            textAnchor={peak === 0 ? 'start' : peak === points.length - 1 ? 'end' : 'middle'}
            fontSize={11}
            fontWeight={600}
            fill={CHART.ink}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {tick(values[peak]!)}
          </text>
        )}

        {/* The crosshair finds the x, so the reader aims at a date and not at a
            2px line. */}
        {hovered && (
          <g pointerEvents="none">
            <line
              x1={x(active!)}
              x2={x(active!)}
              y1={pad.top}
              y2={pad.top + plotHeight}
              stroke={CHART.axis}
              strokeWidth={1}
            />
            {variant === 'area' && (
              <circle
                cx={x(active!)}
                cy={y(hovered.value)}
                r={5}
                fill={color}
                stroke={CHART.surface}
                strokeWidth={2}
              />
            )}
          </g>
        )}
      </svg>

      {hovered && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-ink-100 bg-white px-3 py-2 shadow-raised"
          style={{
            left: Math.min(Math.max(x(active!), 66), width - 66),
            top: 0,
          }}
        >
          <p className="nums text-sm font-semibold text-ink-900">
            {hovered.value.toLocaleString('en-IN')}{' '}
            <span className="font-normal text-ink-500">{label.toLowerCase()}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-500">
            <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: color }} />
            {dayLabelLong(hovered.date)}
          </p>
        </div>
      )}

      {/* Every value the tooltip shows is reachable without a pointer. */}
      <table className="sr-only">
        <caption>{label} by day</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{dayLabelLong(point.date)}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The container's width in CSS pixels, remeasured when it changes.
 *
 * ResizeObserver rather than a window resize listener: the sidebar collapsing
 * changes the chart's width without the window changing at all.
 */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    setWidth(element.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width;
      if (next != null) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [width, ref] as const;
}

/**
 * Twelve points at stat-tile size. No axes, no labels: it says "rising",
 * "falling" or "flat" beside a number that says how much.
 */
export function Sparkline({
  points,
  color = CHART.views,
  width = 84,
  height = 26,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;

  const max = Math.max(...points, 1);
  const step = width / (points.length - 1);
  const y = (value: number) => height - 2 - (value / max) * (height - 4);

  const path = points
    .map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)} ${y(value).toFixed(1)}`)
    .join(' ');

  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={`${path} L${width} ${height} L0 ${height} Z`} fill={color} fillOpacity={0.1} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={width} cy={y(points.at(-1)!)} r={2.5} fill={color} />
    </svg>
  );
}
