/**
 * Home-loan arithmetic.
 *
 * Kept free of React and of formatting so the numbers can be tested directly and
 * reused by anything that needs them — the calculator on the home page, a figure
 * on a listing, a future affordability filter.
 *
 * Everything here works in RUPEES, not paisa. The calculator is a planning tool
 * fed by a person typing "85,00,000" into a box; it never reads or writes the
 * `price` column, which is the only reason it is safe to leave the storage unit
 * behind. Callers holding paisa convert on the way in.
 *
 * Rounding: instalments are computed at full precision and only the displayed
 * figures are rounded. Rounding the instalment first and then multiplying by 240
 * moves the total by thousands of rupees, which a borrower checking our number
 * against the bank's would notice.
 */

export type EmiInput = {
  /** Amount actually borrowed, in rupees. */
  principal: number;
  /** Nominal annual rate as a percentage, e.g. 10.5. */
  annualRatePercent: number;
  /** Loan term in months. */
  months: number;
  /** Voluntary amount paid on top of the instalment every month. */
  extraPerMonth?: number;
  /** A single voluntary payment, applied after `lumpSumAtMonth` instalments. */
  lumpSum?: number;
  lumpSumAtMonth?: number;
};

export type AmortisationRow = {
  /** 1-based instalment number. */
  month: number;
  /** Contractual instalment paid this month. */
  instalment: number;
  /** Voluntary amount paid this month on top of the instalment. */
  extra: number;
  interest: number;
  principal: number;
  /** Outstanding after this month's payments. */
  balance: number;
};

export type EmiSchedule = {
  /** The contractual monthly instalment. */
  emi: number;
  /** Instalments actually made. Lower than `months` when prepaying. */
  monthsToPayOff: number;
  totalInterest: number;
  totalPaid: number;
  rows: AmortisationRow[];
};

export type YearSummary = {
  /** 1-based loan year. */
  year: number;
  interest: number;
  principal: number;
  /** Outstanding at the end of the year. */
  balance: number;
  /** Everything paid in the year, instalments plus voluntary payments. */
  paid: number;
};

/**
 * The standard amortised instalment.
 *
 * A zero rate is not a rounding edge here — it is what an interest-free family
 * loan looks like, and people do model those — so it divides rather than
 * dividing by zero inside the annuity formula.
 */
export function monthlyInstalment(
  principal: number,
  annualRatePercent: number,
  months: number,
): number {
  if (!isFinite(principal) || principal <= 0) return 0;
  if (!isFinite(months) || months <= 0) return 0;

  const r = annualRatePercent / 12 / 100;
  if (r <= 0) return principal / months;

  const growth = Math.pow(1 + r, months);
  return (principal * r * growth) / (growth - 1);
}

/**
 * Builds the full month-by-month schedule.
 *
 * The loop runs to at most `months`, so a prepayment can only ever shorten it.
 * The final instalment is trimmed to whatever is actually outstanding, which is
 * why the last row never leaves a few rupees of negative balance behind.
 */
export function buildSchedule(input: EmiInput): EmiSchedule {
  const { principal, annualRatePercent, months } = input;
  const extraPerMonth = Math.max(0, input.extraPerMonth ?? 0);
  const lumpSum = Math.max(0, input.lumpSum ?? 0);
  const lumpSumAtMonth = Math.max(1, Math.round(input.lumpSumAtMonth ?? 12));

  const emi = monthlyInstalment(principal, annualRatePercent, months);

  if (emi <= 0) {
    return { emi: 0, monthsToPayOff: 0, totalInterest: 0, totalPaid: 0, rows: [] };
  }

  const r = annualRatePercent / 12 / 100;
  const rows: AmortisationRow[] = [];

  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;

  for (let month = 1; month <= months && balance > 0.005; month++) {
    const interest = balance * r;

    // The contractual payment cannot exceed what is left plus this month's
    // interest — that is the final, smaller instalment.
    const instalment = Math.min(emi, balance + interest);
    let principalPaid = instalment - interest;

    let extra = Math.min(extraPerMonth, Math.max(0, balance - principalPaid));
    if (month === lumpSumAtMonth) {
      extra += Math.min(lumpSum, Math.max(0, balance - principalPaid - extra));
    }

    principalPaid += extra;
    balance = Math.max(0, balance - principalPaid);

    totalInterest += interest;
    totalPaid += instalment + extra;

    rows.push({
      month,
      instalment,
      extra,
      interest,
      principal: principalPaid,
      balance,
    });
  }

  return {
    emi,
    monthsToPayOff: rows.length,
    totalInterest,
    totalPaid,
    rows,
  };
}

/** Collapses the schedule to one row per year, which is the only view worth showing by default. */
export function summariseByYear(schedule: EmiSchedule): YearSummary[] {
  const years: YearSummary[] = [];

  for (const row of schedule.rows) {
    const year = Math.ceil(row.month / 12);
    let bucket = years[year - 1];

    if (!bucket) {
      bucket = { year, interest: 0, principal: 0, balance: row.balance, paid: 0 };
      years[year - 1] = bucket;
    }

    bucket.interest += row.interest;
    bucket.principal += row.principal;
    bucket.paid += row.instalment + row.extra;
    bucket.balance = row.balance;
  }

  return years.filter(Boolean);
}

export type PrepaymentSaving = {
  monthsSaved: number;
  interestSaved: number;
};

/** What the voluntary payments actually bought, against the same loan without them. */
export function prepaymentSaving(input: EmiInput): PrepaymentSaving {
  const withExtra = buildSchedule(input);
  const baseline = buildSchedule({
    principal: input.principal,
    annualRatePercent: input.annualRatePercent,
    months: input.months,
  });

  return {
    monthsSaved: Math.max(0, baseline.monthsToPayOff - withExtra.monthsToPayOff),
    interestSaved: Math.max(0, baseline.totalInterest - withExtra.totalInterest),
  };
}

/**
 * Nepal Rastra Bank caps residential loan-to-value at 80% inside the valley and
 * for first homes; lenders in practice sit between 60% and 80% depending on the
 * property and the borrower. A buyer who has budgeted a 10% deposit needs to
 * know that before they visit a bank, not after.
 */
export const TYPICAL_MAX_LTV = 0.8;

/**
 * Lenders size an instalment against income rather than against the property.
 * The usual working figure is that total monthly obligations stay under about
 * 50% of documented monthly income.
 */
export const TYPICAL_MAX_EMI_TO_INCOME = 0.5;

export function loanToValue(price: number, downPayment: number): number {
  if (price <= 0) return 0;
  return Math.min(1, Math.max(0, (price - downPayment) / price));
}

/** Largest instalment that still clears the usual income test. */
export function affordableInstalment(monthlyIncome: number): number {
  return Math.max(0, monthlyIncome) * TYPICAL_MAX_EMI_TO_INCOME;
}

/** Term in months as "18 years 4 months", skipping whichever part is zero. */
export function formatTerm(months: number): string {
  if (months <= 0) return '—';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (rest) parts.push(`${rest} ${rest === 1 ? 'month' : 'months'}`);
  return parts.join(' ');
}
