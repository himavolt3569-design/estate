'use client';

import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';

import { Input } from '@/components/ui/primitives';
import { NEPAL_DIAL_CODE, parseNepaliPhone } from '@/lib/phone/nepal';
import { cn } from '@/lib/utils';

export type ContactNumberDraft = {
  /** What the seller typed. Normalised to E.164 on save, never before. */
  phone: string;
  label: string;
  isWhatsapp: boolean;
};

export const MAX_CONTACT_NUMBERS = 3;

export function emptyContactNumber(): ContactNumberDraft {
  return { phone: '', label: '', isWhatsapp: false };
}

/**
 * Up to three numbers per listing, with one of them optionally on WhatsApp.
 *
 * The +977 sits outside the input rather than inside its value. A prefilled
 * "+977" that the user can select and delete produces numbers stored with no
 * country code, and a placeholder that only looks like a prefix produces numbers
 * stored with it typed twice. A fixed adornment can do neither.
 *
 * WhatsApp is a radio, not a checkbox: the schema carries one WhatsApp number
 * per listing, so offering three checkboxes would let the seller ask for
 * something the database will refuse.
 */
export function ContactNumbersField({
  value,
  onChange,
  error,
}: {
  value: ContactNumberDraft[];
  onChange: (next: ContactNumberDraft[]) => void;
  error?: string;
}) {
  const groupId = useId();
  const rows = value.length > 0 ? value : [emptyContactNumber()];

  function update(index: number, patch: Partial<ContactNumberDraft>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setWhatsapp(index: number) {
    onChange(
      rows.map((row, i) => ({
        ...row,
        // Tapping the one already chosen turns it off, so "no WhatsApp on this
        // listing" stays reachable without a fourth control.
        isWhatsapp: i === index ? !row.isWhatsapp : false,
      })),
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="label mb-1">Contact numbers</legend>
      <p className="text-xs leading-relaxed text-ink-500">
        Up to {MAX_CONTACT_NUMBERS}. Buyers see these only after they sign in and ask, and every
        time one is shown you are told who saw it.
      </p>

      <ul className="space-y-3">
        {rows.map((row, index) => {
          const parsed = row.phone.trim() ? parseNepaliPhone(row.phone) : null;
          const invalid = parsed?.ok === false;
          const isMobile = parsed?.ok === true && parsed.kind === 'mobile';
          const inputId = `${groupId}-phone-${index}`;

          return (
            <li key={index} className="rounded-xl border border-ink-200 bg-white p-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={inputId} className="sr-only">
                    Phone number {index + 1}
                  </label>
                  <div
                    className={cn(
                      'flex items-stretch overflow-hidden rounded-lg border bg-white',
                      invalid ? 'border-clay-400' : 'border-ink-200 focus-within:border-royal-500',
                    )}
                  >
                    <span
                      aria-hidden
                      className="nums flex items-center border-r border-ink-200 bg-ink-50 px-3 text-sm font-medium text-ink-600"
                    >
                      {NEPAL_DIAL_CODE}
                    </span>
                    <input
                      id={inputId}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={row.phone}
                      onChange={(event) =>
                        // Letters are rejected at the keystroke, not at submit.
                        update(index, { phone: event.target.value.replace(/[^\d\s-]/g, '') })
                      }
                      placeholder="9840838944"
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? `${inputId}-error` : undefined}
                      className="nums w-full min-w-0 px-3 py-2 text-sm outline-none placeholder:text-ink-300"
                    />
                  </div>
                </div>

                <div className="w-32 shrink-0">
                  <label htmlFor={`${inputId}-label`} className="sr-only">
                    Label for number {index + 1}
                  </label>
                  <Input
                    id={`${inputId}-label`}
                    value={row.label}
                    onChange={(event) => update(index, { label: event.target.value.slice(0, 40) })}
                    placeholder="Office"
                  />
                </div>

                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    aria-label={`Remove number ${index + 1}`}
                    className="rounded-lg border border-ink-200 p-2 text-ink-500 transition-colors hover:border-clay-300 hover:bg-clay-50 hover:text-clay-700"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                )}
              </div>

              {invalid && (
                <p id={`${inputId}-error`} role="alert" className="mt-2 text-xs text-clay-700">
                  {parsed.error}
                </p>
              )}

              <label
                className={cn(
                  'mt-2.5 flex w-fit items-center gap-2 text-xs',
                  isMobile ? 'cursor-pointer text-ink-700' : 'cursor-not-allowed text-ink-400',
                )}
              >
                <input
                  type="checkbox"
                  checked={row.isWhatsapp}
                  // A landline cannot be on WhatsApp, so the control says so
                  // rather than accepting a choice that will never work.
                  disabled={!isMobile}
                  onChange={() => setWhatsapp(index)}
                  className="size-4 rounded border-ink-300 text-royal-600 focus:ring-royal-500 disabled:opacity-40"
                />
                <MessageCircle aria-hidden className="size-3.5" />
                Use this number for WhatsApp
                {!isMobile && row.phone.trim() && ' (mobile numbers only)'}
              </label>
            </li>
          );
        })}
      </ul>

      {rows.length < MAX_CONTACT_NUMBERS && (
        <button
          type="button"
          onClick={() => onChange([...rows, emptyContactNumber()])}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300 px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-royal-400 hover:bg-royal-50/50 hover:text-royal-700"
        >
          <Plus aria-hidden className="size-4" />
          Add another number
        </button>
      )}

      {error && (
        <p role="alert" className="text-xs text-clay-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
