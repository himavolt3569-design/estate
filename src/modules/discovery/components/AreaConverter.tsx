'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { SelectMenu } from '@/components/ui/select-menu';
import type { Dictionary } from '@/i18n';

/*
 * A working land-unit converter.
 *
 * Nepal runs two traditional systems side by side and both appear in real
 * listings: ropani/aana/paisa/daam in the hills and the valley, bigha/kattha/
 * dhur in the terai. A buyer comparing a 4 aana plot in Lalitpur against a
 * 2 kattha plot in Birgunj genuinely cannot do that arithmetic in their head,
 * and diaspora buyers often cannot do either system.
 *
 * The factors mirror area_to_sqm() in migration 0003 exactly. Square metres is
 * the canonical unit on both sides, so a conversion shown here and a stored
 * area can never disagree.
 */
const TO_SQM = {
  sqm: 1,
  sqft: 0.09290304,
  ropani: 508.72,
  aana: 31.795,
  paisa: 7.94875,
  daam: 1.9871875,
  bigha: 6772.63,
  kattha: 338.6315,
  dhur: 16.931575,
} as const;

type Unit = keyof typeof TO_SQM;

const INPUT_UNITS: Unit[] = ['ropani', 'aana', 'bigha', 'kattha', 'dhur', 'sqft', 'sqm'];

/** Breaks a square-metre value into whole ropani, aana, paisa and daam. */
function toRopaniChain(sqm: number) {
  let rest = sqm;
  const ropani = Math.floor(rest / TO_SQM.ropani);
  rest -= ropani * TO_SQM.ropani;
  const aana = Math.floor(rest / TO_SQM.aana);
  rest -= aana * TO_SQM.aana;
  const paisa = Math.floor(rest / TO_SQM.paisa);
  rest -= paisa * TO_SQM.paisa;
  const daam = Math.round(rest / TO_SQM.daam);
  return { ropani, aana, paisa, daam };
}

/** Breaks a square-metre value into whole bigha, kattha and dhur. */
function toBighaChain(sqm: number) {
  let rest = sqm;
  const bigha = Math.floor(rest / TO_SQM.bigha);
  rest -= bigha * TO_SQM.bigha;
  const kattha = Math.floor(rest / TO_SQM.kattha);
  rest -= kattha * TO_SQM.kattha;
  const dhur = Math.round(rest / TO_SQM.dhur);
  return { bigha, kattha, dhur };
}

const nf = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function AreaConverter({ t }: { t: Dictionary['converter'] }) {
  const [amount, setAmount] = React.useState('4');
  const [unit, setUnit] = React.useState<Unit>('aana');

  const parsed = Number.parseFloat(amount);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const sqm = value * TO_SQM[unit];

  const r = toRopaniChain(sqm);
  const b = toBighaChain(sqm);

  // A ±15% band around the converted size, so the result is a way into the
  // listings rather than a dead end.
  const searchHref = `/search?category=land&area_min=${Math.round(sqm * 0.85)}&area_max=${Math.round(
    sqm * 1.15,
  )}`;

  return (
    <div className="thread-top overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-raised">
      <div className="grid gap-px bg-ink-200 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* ---------------- Input ---------------- */}
        <div className="bg-white p-6 sm:p-8">
          <label htmlFor="area-amount" className="label block">
            {t.plotSize}
          </label>
          <div className="mt-3 flex gap-2">
            <input
              id="area-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="nums h-12 w-24 rounded-lg border border-ink-200 bg-white px-3 text-lg font-medium text-ink-900 shadow-sm transition-colors hover:border-ink-300 focus-visible:border-royal-500 focus-visible:ring-2 focus-visible:ring-royal-500/20 focus-visible:outline-none"
            />
            <SelectMenu
              id="area-unit"
              ariaLabel={t.unit}
              value={unit}
              onValueChange={(value) => setUnit(value as Unit)}
              className="flex-1"
              options={INPUT_UNITS.map((u) => ({ value: u, label: t.units[u] }))}
            />
          </div>

          <dl className="mt-6 space-y-3 border-t border-ink-100 pt-5">
            <Row label={t.squareFeet} value={`${nf.format(sqm / TO_SQM.sqft)}`} />
            <Row label={t.squareMetres} value={`${nf.format(sqm)}`} />
          </dl>
        </div>

        {/* ---------------- Both traditional systems ---------------- */}
        <div className="bg-white p-6 sm:p-8">
          <p className="label">{t.inBoth}</p>

          <div className="mt-4 space-y-4">
            <Chain
              region={t.hills}
              parts={[
                { n: r.ropani, u: t.units.ropani },
                { n: r.aana, u: t.units.aana },
                { n: r.paisa, u: t.units.paisa },
                { n: r.daam, u: t.units.daam },
              ]}
            />
            <Chain
              region={t.terai}
              parts={[
                { n: b.bigha, u: t.units.bigha },
                { n: b.kattha, u: t.units.kattha },
                { n: b.dhur, u: t.units.dhur },
              ]}
            />
          </div>

          <Button asChild variant="secondary" size="sm" className="mt-6 w-full sm:w-auto">
            <Link href={searchHref}>
              {t.findSimilar} <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="nums text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

/**
 * The figure sits in medium against its unit in extra-light: the same
 * weight-contrast pairing the property cards use, so a size reads the same way
 * everywhere in the product.
 */
function Chain({
  region,
  parts,
}: {
  region: string;
  parts: Array<{ n: number; u: string }>;
}) {
  return (
    <div className="border-t border-ink-100 pt-3.5">
      <p className="text-2xs tracking-wide text-ink-400 uppercase">{region}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {parts.map((part) => (
          <span key={part.u} className="flex items-baseline gap-1.5">
            <span
              className={`nums text-xl font-medium ${part.n === 0 ? 'text-ink-300' : 'text-ink-900'}`}
            >
              {part.n}
            </span>
            <span className="text-xs font-extralight text-ink-400">{part.u}</span>
          </span>
        ))}
      </p>
    </div>
  );
}
