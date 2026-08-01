import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Text inputs                                                                 */
/* -------------------------------------------------------------------------- */
/*
 * Hard-cornered, and the focus state thickens the underline rather than adding
 * a ring. On a form that is mostly rules, a focused field should read as the
 * active line on a drawing.
 */
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-12 w-full rounded-md border border-ink-200 bg-white px-4 text-sm text-ink-900 shadow-sm',
        'transition-all duration-200 placeholder:text-ink-300 hover:border-royal-400',
        'focus-visible:border-royal-500 focus-visible:ring-2 focus-visible:ring-royal-500/20 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60',
        'aria-[invalid=true]:border-clay-500 aria-[invalid=true]:focus-visible:ring-clay-500/20',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full rounded-md border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 shadow-sm',
        'transition-all duration-200 placeholder:text-ink-300 hover:border-royal-400',
        'focus-visible:border-royal-500 focus-visible:ring-2 focus-visible:ring-royal-500/20 focus-visible:outline-none',
        'aria-[invalid=true]:border-clay-500 aria-[invalid=true]:focus-visible:ring-clay-500/20',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-12 w-full rounded-md border border-ink-200 bg-white px-4 text-sm text-ink-900 shadow-sm',
        'transition-all duration-200 hover:border-royal-400',
        'focus-visible:border-royal-500 focus-visible:ring-2 focus-visible:ring-royal-500/20 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60',
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = 'Select';

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 border px-2.5 py-1 text-2xs font-semibold tracking-wide uppercase rounded-full shadow-sm',
  {
    variants: {
      tone: {
        neutral: 'border-ink-200 bg-white text-ink-500',
        // Emerald is reserved: it appears only where something is verified.
        verified: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        pending: 'border-ochre-200 bg-ochre-50 text-ochre-700',
        rejected: 'border-clay-200 bg-clay-50 text-clay-700',
        royal: 'border-royal-200 bg-royal-50 text-royal-800',
        solid: 'border-royal-800 bg-royal-800 text-white',
        crimson: 'border-crimson-200 bg-crimson-50 text-crimson-700',
        marigold: 'border-marigold-200 bg-marigold-50 text-marigold-800',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Surface                                                                     */
/* -------------------------------------------------------------------------- */
/** A ruled panel. Depth comes from shadow and rounded corners. */
export function Surface({
  className,
  ticked = false,
  ...props
}: React.ComponentProps<'div'> & { ticked?: boolean }) {
  return (
    <div
      className={cn('rounded-xl border border-ink-100 bg-white shadow-soft', className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                    */
/* -------------------------------------------------------------------------- */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('skeleton rounded-sm', className)} aria-hidden {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Label + Field                                                               */
/* -------------------------------------------------------------------------- */
export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-sm font-medium text-ink-800', className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>
          {label}
          {required && (
            <span aria-hidden className="ml-1 text-clay-600">
              *
            </span>
          )}
        </Label>
        {hint && (
          <span id={hintId} className="text-xs text-ink-400">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-clay-700">
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-ink-100 bg-gradient-to-b from-ink-50/30 to-ink-50/80 px-6 py-16 text-center shadow-soft">
      {icon && <div className="mb-6 text-ink-400">{icon}</div>}
      <h3 className="text-xl font-semibold text-ink-900">{title}</h3>
      <p className="mt-3 max-w-sm text-sm text-ink-500 leading-relaxed">{description}</p>
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */
/**
 * The index number is set in the extra-light weight against the heading's
 * semibold, which is the weight-contrast pairing the whole type system rests
 * on. It is only passed where the sections genuinely form a sequence.
 */
export function SectionHeading({
  eyebrow,
  title,
  index,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  index?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative flex items-end justify-between gap-6 pb-4', className)}>
      <div className="flex items-end gap-4">
        {index && (
          <span aria-hidden className="nums thin -mb-1 text-3xl leading-none text-ink-300">
            {index}
          </span>
        )}
        <div>
          {eyebrow && <p className="label mb-2 text-crimson-600">{eyebrow}</p>}
          <h2 className="text-display-md text-ink-900">{title}</h2>
        </div>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}

      {/* The rule under a heading was a full-width hairline in ink-900, which
          made every section start with a hard black line. It is now the thread:
          a short warm stroke that stops, with the hairline continuing past it. */}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-ink-200" />
      <span aria-hidden className="thread absolute bottom-0 left-0 h-[2px] w-16 rounded-full" />
    </div>
  );
}
