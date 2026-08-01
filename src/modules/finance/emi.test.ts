import { describe, expect, it } from 'vitest';

import {
  affordableInstalment,
  buildSchedule,
  formatTerm,
  loanToValue,
  monthlyInstalment,
  prepaymentSaving,
  summariseByYear,
} from './emi';

describe('monthlyInstalment', () => {
  it('matches the standard annuity figure', () => {
    // Rs 50,00,000 over 20 years at 10.5% is Rs 49,919 a month. Checked against
    // the published EMI tables Nepali lenders hand out at the counter.
    expect(monthlyInstalment(5_000_000, 10.5, 240)).toBeCloseTo(49_918.7, 0);
  });

  it('divides evenly when there is no interest', () => {
    expect(monthlyInstalment(1_200_000, 0, 120)).toBe(10_000);
  });

  it('returns zero rather than NaN for nonsense input', () => {
    expect(monthlyInstalment(0, 10, 240)).toBe(0);
    expect(monthlyInstalment(1_000_000, 10, 0)).toBe(0);
    expect(monthlyInstalment(-5, 10, 240)).toBe(0);
  });
});

describe('buildSchedule', () => {
  const loan = { principal: 5_000_000, annualRatePercent: 10.5, months: 240 };

  it('amortises exactly to zero over the full term', () => {
    const schedule = buildSchedule(loan);

    expect(schedule.monthsToPayOff).toBe(240);
    expect(schedule.rows.at(-1)!.balance).toBeCloseTo(0, 6);
  });

  it('has principal repayments that sum to the amount borrowed', () => {
    const schedule = buildSchedule(loan);
    const repaid = schedule.rows.reduce((sum, row) => sum + row.principal, 0);

    expect(repaid).toBeCloseTo(loan.principal, 4);
  });

  it('reconciles total paid against principal plus interest', () => {
    const schedule = buildSchedule(loan);

    expect(schedule.totalPaid).toBeCloseTo(loan.principal + schedule.totalInterest, 4);
  });

  it('shortens the loan when paying extra every month', () => {
    const schedule = buildSchedule({ ...loan, extraPerMonth: 10_000 });

    expect(schedule.monthsToPayOff).toBeLessThan(240);
    expect(schedule.rows.at(-1)!.balance).toBeCloseTo(0, 6);
  });

  it('applies a lump sum in the month it is scheduled for', () => {
    const schedule = buildSchedule({ ...loan, lumpSum: 500_000, lumpSumAtMonth: 24 });
    const month24 = schedule.rows.find((row) => row.month === 24)!;

    expect(month24.extra).toBeCloseTo(500_000, 4);
    expect(schedule.monthsToPayOff).toBeLessThan(240);
  });

  it('never lets a voluntary payment overshoot the balance', () => {
    const schedule = buildSchedule({
      principal: 200_000,
      annualRatePercent: 9,
      months: 60,
      lumpSum: 10_000_000,
      lumpSumAtMonth: 2,
    });

    expect(schedule.rows.at(-1)!.balance).toBe(0);
    expect(schedule.totalPaid).toBeLessThan(300_000);
  });
});

describe('summariseByYear', () => {
  it('splits a 20-year loan into 20 rows that reconcile with the monthly schedule', () => {
    const schedule = buildSchedule({ principal: 5_000_000, annualRatePercent: 10.5, months: 240 });
    const years = summariseByYear(schedule);

    expect(years).toHaveLength(20);
    expect(years.reduce((sum, y) => sum + y.interest, 0)).toBeCloseTo(schedule.totalInterest, 4);
    expect(years.at(-1)!.balance).toBeCloseTo(0, 6);
  });
});

describe('prepaymentSaving', () => {
  it('reports nothing saved when nothing extra is paid', () => {
    const saving = prepaymentSaving({ principal: 5_000_000, annualRatePercent: 10.5, months: 240 });

    expect(saving.monthsSaved).toBe(0);
    expect(saving.interestSaved).toBeCloseTo(0, 6);
  });

  it('reports real savings against the same loan without prepayment', () => {
    const saving = prepaymentSaving({
      principal: 5_000_000,
      annualRatePercent: 10.5,
      months: 240,
      extraPerMonth: 10_000,
    });

    expect(saving.monthsSaved).toBeGreaterThan(0);
    expect(saving.interestSaved).toBeGreaterThan(0);
  });
});

describe('affordability helpers', () => {
  it('computes loan to value', () => {
    expect(loanToValue(10_000_000, 3_000_000)).toBeCloseTo(0.7, 6);
    expect(loanToValue(0, 100)).toBe(0);
  });

  it('caps the instalment at half of monthly income', () => {
    expect(affordableInstalment(120_000)).toBe(60_000);
    expect(affordableInstalment(-5)).toBe(0);
  });

  it('formats a term the way it is spoken', () => {
    expect(formatTerm(240)).toBe('20 years');
    expect(formatTerm(1)).toBe('1 month');
    expect(formatTerm(15)).toBe('1 year 3 months');
    expect(formatTerm(0)).toBe('—');
  });
});
