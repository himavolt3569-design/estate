'use client';

import { ChevronDown, TriangleAlert, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatIndianDigits } from '@/lib/format';
import { cn } from '@/lib/utils';

import {
  buildSchedule,
  formatTerm,
  loanToValue,
  prepaymentSaving,
  summariseByYear,
  TYPICAL_MAX_EMI_TO_INCOME,
  TYPICAL_MAX_LTV,
} from '../emi';

type Copy = {
  price: string;
  downPayment: string;
  loanAmount: string;
  rate: string;
  tenure: string;
  years: string;
  perYear: string;
  monthly: string;
  totalInterest: string;
  totalPaid: string;
  paidOffIn: string;
  principalShare: string;
  interestShare: string;
  payExtra: string;
  payExtraHint: string;
  extraMonthly: string;
  lumpSum: string;
  lumpSumMonth: string;
  saved: string;
  savedInterest: string;
  savedTime: string;
  earlier: string;
  income: string;
  incomeHint: string;
  fits: string;
  tight: string;
  ltvWarning: string;
  yearByYear: string;
  showSchedule: string;
  hideSchedule: string;
  year: string;
  balance: string;
  paidThisYear: string;
  disclaimer: string;
  findWithin: string;
};

/** "Rs 85,00,000" — always the exact figure, because this is a money tool. */
function rs(value: number): string {
  return `Rs ${formatIndianDigits(Math.round(value))}`;
}

type Verdict = { tone: 'good' | 'ok' | 'caution'; headline: string; body: string };

/**
 * A plain answer to the question people are actually asking.
 *
 * Four numbers that each mean something on their own do not add up to a
 * decision, and a first-time buyer has no reference for whether 58% interest
 * over 20 years is normal. This reads the same inputs and says the one thing a
 * careful friend would say — never "yes, buy it", because that is not ours to
 * say, but which part of the plan is the weak one.
 *
 * Ordered by severity: the worst true thing is the thing worth hearing.
 */
function verdictFor({
  ltv,
  emi,
  income,
  interestShare,
  years,
}: {
  ltv: number;
  emi: number;
  income: number;
  interestShare: number;
  years: number;
}): Verdict {
  if (income > 0 && emi > income * 0.6) {
    return {
      tone: 'caution',
      headline: 'This one looks out of reach',
      body: 'The instalment takes more than 60% of your income. Most banks will refuse it outright. Look at a lower price, or save more for the deposit first.',
    };
  }

  if (income > 0 && emi > income * TYPICAL_MAX_EMI_TO_INCOME) {
    return {
      tone: 'caution',
      headline: 'Tight, but a bank might still listen',
      body: 'The instalment is over half your income, which is the usual limit. A longer term or a bigger deposit brings it back inside.',
    };
  }

  if (ltv > TYPICAL_MAX_LTV + 0.0001) {
    return {
      tone: 'ok',
      headline: 'The deposit is the problem, not the payment',
      body: 'You are asking the bank for more than the 80% they normally lend. Put in more upfront and the rest of this plan works.',
    };
  }

  if (interestShare > 0.55) {
    return {
      tone: 'ok',
      headline: 'Workable, but the interest is heavy',
      body: 'More than half of everything you repay is interest. Shortening the term by a few years, or paying a little extra each month, changes that a lot.',
    };
  }

  if (income > 0 && emi <= income * 0.35) {
    return {
      tone: 'good',
      headline: 'This sits comfortably',
      body: 'The instalment is a third of your income or less, and the deposit is one a bank will accept. You would have room left if rates move.',
    };
  }

  return {
    tone: 'good',
    headline: 'A sensible plan on paper',
    body:
      years >= 25
        ? 'The deposit and the instalment both look reasonable. The term is long, so check whether you can shorten it later without a penalty.'
        : 'The deposit and the instalment both look reasonable. Add your income above and this will tell you whether a bank is likely to agree.',
  };
}

const VERDICT_STYLE = {
  good: {
    wrap: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-500',
    head: 'text-emerald-900',
    body: 'text-emerald-900/75',
  },
  ok: {
    wrap: 'border-marigold-200 bg-marigold-50',
    dot: 'bg-marigold-400',
    head: 'text-marigold-900',
    body: 'text-marigold-900/75',
  },
  caution: {
    wrap: 'border-clay-200 bg-clay-50',
    dot: 'bg-clay-500',
    head: 'text-clay-800',
    body: 'text-clay-800/75',
  },
} as const;

/** The spoken form, shown under an input so a long number stays readable. */
function spoken(value: number): string {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(2).replace(/\.?0+$/, '')} crore`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(2).replace(/\.?0+$/, '')} lakh`;
  return formatIndianDigits(value);
}

export function EmiCalculator({ t }: { t: Copy }) {
  const [price, setPrice] = useState(10_000_000);
  const [downPayment, setDownPayment] = useState(3_000_000);
  const [rate, setRate] = useState(10.5);
  const [years, setYears] = useState(20);

  const [extraOpen, setExtraOpen] = useState(false);
  const [extraPerMonth, setExtraPerMonth] = useState(0);
  const [lumpSum, setLumpSum] = useState(0);
  const [lumpSumAtMonth, setLumpSumAtMonth] = useState(24);

  const [income, setIncome] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const principal = Math.max(0, price - downPayment);
  const months = years * 12;

  const schedule = useMemo(
    () =>
      buildSchedule({
        principal,
        annualRatePercent: rate,
        months,
        extraPerMonth,
        lumpSum,
        lumpSumAtMonth,
      }),
    [principal, rate, months, extraPerMonth, lumpSum, lumpSumAtMonth],
  );

  const saving = useMemo(
    () =>
      extraPerMonth > 0 || lumpSum > 0
        ? prepaymentSaving({
            principal,
            annualRatePercent: rate,
            months,
            extraPerMonth,
            lumpSum,
            lumpSumAtMonth,
          })
        : null,
    [principal, rate, months, extraPerMonth, lumpSum, lumpSumAtMonth],
  );

  const years_ = useMemo(() => summariseByYear(schedule), [schedule]);

  const ltv = loanToValue(price, downPayment);
  const ltvTooHigh = ltv > TYPICAL_MAX_LTV + 0.0001;

  // Proportion of every rupee repaid that is interest rather than the loan.
  const interestShare =
    schedule.totalPaid > 0 ? schedule.totalInterest / schedule.totalPaid : 0;

  const verdict = verdictFor({ ltv, emi: schedule.emi, income, interestShare, years });
  const verdictStyle = VERDICT_STYLE[verdict.tone];

  return (
    <div className="thread-top overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-raised">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* ---------------------------------------------------------------- */}
        {/* Inputs                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className="space-y-7 border-ink-100 p-6 sm:p-8 lg:border-r">
          <MoneyField
            label={t.price}
            value={price}
            onChange={(next) => {
              setPrice(next);
              // Keep the deposit inside the price rather than letting it drift
              // past it, which would show a negative loan.
              if (downPayment > next) setDownPayment(next);
            }}
            min={100_000}
            max={500_000_000}
            step={100_000}
          />

          <MoneyField
            label={t.downPayment}
            value={downPayment}
            onChange={setDownPayment}
            min={0}
            max={price}
            step={50_000}
            trailing={
              <span className="nums text-xs font-medium text-ink-500">
                {price > 0 ? Math.round((downPayment / price) * 100) : 0}%
              </span>
            }
          />

          {ltvTooHigh && (
            <p className="flex gap-2.5 rounded-lg border border-marigold-200 bg-marigold-50 px-3.5 py-3 text-xs leading-relaxed text-marigold-900">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-marigold-600" />
              <span>{t.ltvWarning.replace('{ltv}', String(Math.round(ltv * 100)))}</span>
            </p>
          )}

          <SliderField
            label={t.rate}
            value={rate}
            onChange={setRate}
            min={5}
            max={20}
            step={0.05}
            display={`${rate.toFixed(2).replace(/\.?0+$/, '')}% ${t.perYear}`}
          />

          <SliderField
            label={t.tenure}
            value={years}
            onChange={setYears}
            min={1}
            max={30}
            step={1}
            display={`${years} ${t.years}`}
          />

          {/* Prepayment is where this stops being a toy, but it is also the
              part most people do not need, so it stays folded away. */}
          <div className="rounded-xl border border-ink-100 bg-ink-50/50">
            <button
              type="button"
              onClick={() => setExtraOpen((open) => !open)}
              aria-expanded={extraOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-ink-900">{t.payExtra}</span>
                <span className="mt-0.5 block text-xs text-ink-500">{t.payExtraHint}</span>
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 shrink-0 text-ink-400 transition-transform duration-200',
                  extraOpen && 'rotate-180',
                )}
              />
            </button>

            {extraOpen && (
              <div className="space-y-5 border-t border-ink-100 px-4 pt-5 pb-5">
                <MoneyField
                  label={t.extraMonthly}
                  value={extraPerMonth}
                  onChange={setExtraPerMonth}
                  min={0}
                  max={Math.max(10_000, Math.round(schedule.emi * 3))}
                  step={1_000}
                  compact
                />
                <MoneyField
                  label={t.lumpSum}
                  value={lumpSum}
                  onChange={setLumpSum}
                  min={0}
                  max={Math.max(100_000, principal)}
                  step={50_000}
                  compact
                />
                <SliderField
                  label={t.lumpSumMonth}
                  value={lumpSumAtMonth}
                  onChange={setLumpSumAtMonth}
                  min={1}
                  max={months}
                  step={1}
                  display={formatTerm(lumpSumAtMonth)}
                  compact
                />
              </div>
            )}
          </div>

          <MoneyField
            label={t.income}
            hint={t.incomeHint}
            value={income}
            onChange={setIncome}
            min={0}
            max={2_000_000}
            step={5_000}
            compact
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Results                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="bg-ink-50/40 p-6 sm:p-8">
          <p className="label">{t.monthly}</p>
          <p className="figure mt-2 text-5xl text-crimson-700 sm:text-6xl">
            {rs(schedule.emi)}
          </p>

          <dl className="mt-7 grid gap-px overflow-hidden rounded-xl border border-ink-200 bg-ink-200 sm:grid-cols-2">
            <Cell label={t.loanAmount} value={rs(principal)} sub={spoken(principal)} />
            <Cell label={t.totalInterest} value={rs(schedule.totalInterest)} tone="warm" />
            <Cell label={t.totalPaid} value={rs(schedule.totalPaid)} />
            <Cell label={t.paidOffIn} value={formatTerm(schedule.monthsToPayOff)} />
          </dl>

          {/* One bar, labelled directly. A borrower's real question is "how much
              of what I hand over is interest", and that is a proportion, so it
              is drawn as a proportion rather than as a pie or a line. */}
          <div className="mt-7">
            <div className="flex h-3 overflow-hidden rounded-full bg-ink-200">
              <div
                className="bg-royal-700"
                style={{ width: `${(1 - interestShare) * 100}%` }}
              />
              <div className="thread flex-1" />
            </div>
            <div className="mt-2.5 flex flex-wrap justify-between gap-x-6 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5 text-ink-600">
                <span aria-hidden className="size-2 rounded-full bg-royal-700" />
                {t.principalShare}
                <span className="nums font-semibold text-ink-900">
                  {Math.round((1 - interestShare) * 100)}%
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-ink-600">
                <span aria-hidden className="thread size-2 rounded-full" />
                {t.interestShare}
                <span className="nums font-semibold text-ink-900">
                  {Math.round(interestShare * 100)}%
                </span>
              </span>
            </div>
          </div>

          {saving && (saving.monthsSaved > 0 || saving.interestSaved > 0) && (
            <p className="mt-6 flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm leading-relaxed text-emerald-900">
              <Wallet aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>
                {t.saved} <strong className="nums">{rs(saving.interestSaved)}</strong>{' '}
                {t.savedInterest}
                {saving.monthsSaved > 0 && (
                  <>
                    , {t.savedTime}{' '}
                    <strong className="nums">{formatTerm(saving.monthsSaved)}</strong> {t.earlier}
                  </>
                )}
                .
              </span>
            </p>
          )}

          {/* The read on the whole plan. One card, changing with the inputs. */}
          <div className={cn('mt-6 rounded-xl border px-4 py-3.5', verdictStyle.wrap)}>
            <p className={cn('flex items-center gap-2 text-sm font-semibold', verdictStyle.head)}>
              <span aria-hidden className={cn('size-2 shrink-0 rounded-full', verdictStyle.dot)} />
              {verdict.headline}
            </p>
            <p className={cn('mt-1.5 pl-4 text-sm leading-relaxed', verdictStyle.body)}>
              {verdict.body}
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="sm">
              <Link href={`/search?transaction_type=sale&price_max=${Math.round(price * 100)}`}>
                {t.findWithin}
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => setScheduleOpen((open) => !open)}
              aria-expanded={scheduleOpen}
              className="text-sm font-medium text-royal-700 underline underline-offset-4 hover:text-royal-900"
            >
              {scheduleOpen ? t.hideSchedule : t.showSchedule}
            </button>
          </div>

          {/*
            Read as a list, not a spreadsheet.

            The interesting thing in an amortisation schedule is how the split
            between principal and interest flips over the life of the loan, and
            four columns of rupees hide that. Each year carries its own small
            bar, so the flip is visible while scrolling and the exact figures
            are still there for anyone who wants them.
          */}
          {scheduleOpen && (
            <div className="mt-5 overflow-hidden rounded-xl border border-ink-200 bg-white">
              <div className="flex items-center justify-between gap-4 border-b border-ink-100 bg-ink-50/70 px-4 py-2.5">
                <p className="label">{t.yearByYear}</p>
                <p className="flex items-center gap-3 text-2xs text-ink-500">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="size-2 rounded-full bg-royal-700" />
                    {t.principalShare}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden className="thread size-2 rounded-full" />
                    {t.interestShare}
                  </span>
                </p>
              </div>

              <ul className="max-h-96 divide-y divide-ink-100 overflow-auto">
                {years_.map((row) => {
                  const yearTotal = row.principal + row.interest;
                  const principalPct = yearTotal > 0 ? (row.principal / yearTotal) * 100 : 0;
                  const clearedPct =
                    principal > 0 ? Math.round((1 - row.balance / principal) * 100) : 0;

                  return (
                    <li key={row.year} className="px-4 py-3.5 transition-colors hover:bg-ink-50/60">
                      <div className="flex items-baseline justify-between gap-4">
                        <p className="text-sm font-semibold text-ink-900">
                          {t.year} {row.year}
                        </p>
                        <p className="nums text-xs text-ink-500">
                          {clearedPct}% cleared
                        </p>
                      </div>

                      <div
                        className="mt-2 flex h-2 overflow-hidden rounded-full bg-ink-100"
                        role="img"
                        aria-label={`${Math.round(principalPct)}% of this year's payments went to the loan`}
                      >
                        <div className="bg-royal-700" style={{ width: `${principalPct}%` }} />
                        <div className="thread flex-1" />
                      </div>

                      <dl className="mt-2.5 flex flex-wrap justify-between gap-x-6 gap-y-1 text-xs">
                        <div className="flex gap-1.5">
                          <dt className="text-ink-500">{t.principalShare}</dt>
                          <dd className="nums font-medium text-ink-900">{rs(row.principal)}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-ink-500">{t.interestShare}</dt>
                          <dd className="nums font-medium text-marigold-800">{rs(row.interest)}</dd>
                        </div>
                        <div className="flex gap-1.5">
                          <dt className="text-ink-500">{t.balance}</dt>
                          <dd className="nums font-medium text-ink-600">{rs(row.balance)}</dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <p className="mt-6 text-xs leading-relaxed text-ink-400">{t.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Field primitives                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A number box and a slider driving the same value.
 *
 * Both are here on purpose: the slider is how you explore, the box is how you
 * enter the figure you already know. On a phone the slider is also the only one
 * of the two that does not summon a keyboard over the results.
 */
function MoneyField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  trailing,
  compact = false,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  trailing?: React.ReactNode;
  compact?: boolean;
}) {
  const id = useId();
  /** Non-null only while the box is being typed in. See onChange below. */
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink-800">
          {label}
        </label>
        {trailing}
      </div>

      <div className="mt-2 flex items-center rounded-lg border border-ink-200 bg-white shadow-sm transition-colors focus-within:border-royal-500 focus-within:ring-2 focus-within:ring-royal-500/20">
        <span className="pl-3.5 text-sm font-medium text-ink-400">Rs</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft ?? formatIndianDigits(value)}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d]/g, '');

            /*
             * The field holds the raw string while it is being edited and is
             * only clamped on blur. Clamping on every keystroke meant deleting
             * a digit from "1,00,00,000" snapped it straight back to the
             * minimum, so the box could not be cleared and retyped at all —
             * backspace simply did nothing.
             */
            setDraft(digits === '' ? '' : formatIndianDigits(Number(digits)));
            const next = digits === '' ? 0 : Number(digits);
            if (next >= min && next <= max) onChange(next);
          }}
          onBlur={() => {
            const digits = (draft ?? '').replace(/[^\d]/g, '');
            const next = digits === '' ? min : Number(digits);
            onChange(Math.min(max, Math.max(min, next)));
            setDraft(null);
          }}
          className={cn(
            'nums w-full bg-transparent px-2.5 text-ink-900 outline-none',
            compact ? 'h-10 text-sm' : 'h-11 text-base font-semibold',
          )}
        />
      </div>

      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range mt-3 w-full"
      />

      {hint ? (
        <p className="mt-1.5 text-xs text-ink-400">{hint}</p>
      ) : (
        !compact && value > 0 && (
          <p className="mt-1.5 text-xs text-ink-400">{spoken(value)}</p>
        )
      )}
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
  compact?: boolean;
}) {
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink-800">
          {label}
        </label>
        <span className={cn('nums font-semibold text-ink-900', compact ? 'text-sm' : 'text-base')}>
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range mt-3 w-full"
      />
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'warm';
}) {
  return (
    <div className="bg-white px-4 py-3.5">
      <dt className="label">{label}</dt>
      <dd
        className={cn(
          'nums mt-1.5 text-lg font-semibold',
          tone === 'warm' ? 'text-marigold-800' : 'text-ink-900',
        )}
      >
        {value}
      </dd>
      {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

