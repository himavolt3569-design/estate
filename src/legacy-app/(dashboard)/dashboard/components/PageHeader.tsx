import { cn } from '@/lib/utils';

/**
 * The heading every dashboard page opens with.
 *
 * It is the same device as the section headings on the landing page — small
 * crimson eyebrow, a display-weight title, a hairline rule with a short warm
 * stroke sitting on top of it — so moving from the public site into the account
 * does not feel like arriving at a different product built by different people.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative pb-5', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="label mb-2 text-crimson-600">{eyebrow}</p>}
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-ink-200" />
      <span aria-hidden className="thread absolute bottom-0 left-0 h-[2px] w-16 rounded-full" />
    </div>
  );
}

/**
 * A rounded panel, matching the calculators on the landing page.
 * `accent` adds the crimson-to-marigold stroke along the top edge; reserve it
 * for the panel on a page that is asking for a decision.
 */
export function Panel({
  accent = false,
  className,
  children,
}: {
  accent?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-soft',
        accent && 'thread-top',
        className,
      )}
    >
      {children}
    </div>
  );
}
