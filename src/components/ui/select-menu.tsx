'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A dropdown the browser does not draw.
 *
 * A native <select> can be styled shut but never open: the option list is an OS
 * widget, so on Windows it arrives as a square white box with a hard blue
 * highlight in the middle of a rounded, warm interface. That mismatch was the
 * single most visible break in the design.
 *
 * This renders the list itself. It keeps the parts that make the native control
 * good — typeahead, arrow keys, Escape, screen-reader semantics — because Radix
 * implements the listbox pattern properly; what it replaces is only the paint.
 *
 * `name` submits a hidden input, so this still works inside a plain GET form
 * like the search filters.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Second line, e.g. the Nepali name of a district. */
  hint?: string;
  disabled?: boolean;
};

export function SelectMenu({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Choose…',
  name,
  id,
  disabled,
  className,
  ariaLabel,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  /*
   * Radix treats '' as "no value", but a filter form genuinely needs an "Any"
   * choice that submits an empty string. The empty option is carried under a
   * sentinel internally and unwrapped on the way out, so callers keep using ''.
   */
  const EMPTY = '__any__';
  const toInner = (raw: string | undefined) => (raw === '' ? EMPTY : raw);
  const toOuter = (raw: string) => (raw === EMPTY ? '' : raw);

  return (
    <RadixSelect.Root
      value={toInner(value)}
      defaultValue={toInner(defaultValue)}
      onValueChange={(next) => onValueChange?.(toOuter(next))}
      disabled={disabled}
      name={name}
    >
      <RadixSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          'flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white px-4 text-left text-sm text-ink-900 shadow-sm',
          'transition-colors hover:border-ink-300',
          'focus-visible:border-royal-500 focus-visible:ring-2 focus-visible:ring-royal-500/20 focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:opacity-60',
          'data-[placeholder]:text-ink-400',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon asChild>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-400" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-100 max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-xl border border-ink-100 bg-white shadow-floating',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          )}
        >
          <RadixSelect.ScrollUpButton className="flex h-6 items-center justify-center bg-white text-ink-400">
            <ChevronUp aria-hidden className="size-3.5" />
          </RadixSelect.ScrollUpButton>

          <RadixSelect.Viewport className="p-1.5">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value || EMPTY}
                value={option.value === '' ? EMPTY : option.value}
                disabled={option.disabled}
                className={cn(
                  'relative flex cursor-pointer items-center gap-2 rounded-lg py-2.5 pr-8 pl-3 text-sm text-ink-800 outline-none select-none',
                  'data-highlighted:bg-crimson-50 data-highlighted:text-crimson-900',
                  'data-[state=checked]:font-semibold data-[state=checked]:text-crimson-800',
                  'data-disabled:pointer-events-none data-disabled:opacity-40',
                )}
              >
                <span className="min-w-0 flex-1">
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  {option.hint && (
                    <span className="mt-0.5 block truncate text-xs font-normal text-ink-400">
                      {option.hint}
                    </span>
                  )}
                </span>
                <RadixSelect.ItemIndicator className="absolute right-2.5">
                  <Check aria-hidden className="size-4 text-crimson-600" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>

          <RadixSelect.ScrollDownButton className="flex h-6 items-center justify-center bg-white text-ink-400">
            <ChevronDown aria-hidden className="size-3.5" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
