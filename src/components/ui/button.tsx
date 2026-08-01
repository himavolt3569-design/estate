import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * Buttons are premium, interactive elements.
 * We use soft rounded corners, subtle shadows, and smooth scaling.
 *
 * Poppins provides a friendly, readable label.
 * Press feedback uses a scale down, and hover uses a slight lift and shadow.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ' +
    'transition-all duration-200 ease-out-expo ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    'hover:-translate-y-0.5 hover:shadow-soft active:scale-95 active:translate-y-0 active:shadow-none ' +
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /*
         * Crimson, not navy. Navy is the colour of the structure — the header,
         * the links, the panels — so when it was also the colour of every
         * button, nothing on a page looked more clickable than anything else.
         * Moving the primary action onto crimson gives the eye one place to
         * land per screen, and is where most of the warmth in the product now
         * comes from.
         */
        primary:
          'rounded-lg border border-transparent bg-crimson-600 text-white shadow-sm hover:bg-crimson-500',
        /** The institutional action: navigation and confirmations that are not the page's main ask. */
        royal:
          'rounded-lg border border-transparent bg-royal-700 text-white shadow-sm hover:bg-royal-600',
        secondary:
          'rounded-lg border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
        ghost: 'rounded-lg border border-transparent text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        /** Emerald stays reserved: it appears only where something is confirmed or verified. */
        approve:
          'rounded-lg border border-transparent bg-emerald-600 text-white shadow-sm hover:bg-emerald-500',
        /** Warm, lower-commitment call to action. Pairs with a crimson primary without competing. */
        marigold:
          'rounded-lg border border-transparent bg-marigold-400 text-marigold-900 shadow-sm hover:bg-marigold-300',
        destructive:
          'rounded-lg border border-clay-200 bg-white text-clay-700 hover:border-clay-300 hover:bg-clay-50',
        link: 'border border-transparent text-royal-600 underline underline-offset-4 hover:text-royal-800 hover:shadow-none hover:translate-y-0 active:scale-100',
        inverse:
          'rounded-md border border-white bg-white text-royal-800 hover:bg-ink-50',
        outlineLight:
          'rounded-md border border-white/60 bg-transparent text-white hover:border-white hover:bg-white/10',
        pill: 'rounded-full border border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        // 44px is the minimum comfortable touch target, and the default because
        // this product is used on phones first.
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-sm',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
