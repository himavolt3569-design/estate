"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/primitives";
import type { Dictionary } from "@/i18n";
import {
  useSiteLanguage,
  useSiteText,
} from "@/components/merokotha/site-language";
import { NepaliAreaResults } from "@/components/merokotha/nepali-area-results";
import {
  compoundAreaToSqm,
  NEPALI_AREA_IN_SQM,
  NEPALI_AREA_SYSTEMS,
  nepaliAreaParts,
  nepaliAreaToSqm,
  parseLandNumber,
  type NepaliAreaSystem,
  type NepaliAreaUnit,
} from "@/lib/nepali-land";

type InputSystem = "single" | NepaliAreaSystem;
const INPUT_UNITS: NepaliAreaUnit[] = [
  "ropani",
  "aana",
  "paisa",
  "daam",
  "bigha",
  "kattha",
  "dhur",
  "sqft",
  "sqm",
];

export function AreaConverter({ t }: { t: Dictionary["converter"] }) {
  const { ui, locale } = useSiteLanguage();
  const text = useSiteText();
  const [system, setSystem] = useState<InputSystem>("single");
  const [amount, setAmount] = useState("4");
  const [unit, setUnit] = useState<NepaliAreaUnit>("aana");
  const [parts, setParts] = useState<string[]>(["0", "4", "0", "0"]);
  let sqm: number | null = null;
  try {
    sqm =
      system === "single"
        ? nepaliAreaToSqm(parseLandNumber(amount), unit)
        : compoundAreaToSqm(system, parts.map(parseLandNumber));
  } catch {
    /* Invalid input clears both outputs below. */
  }
  const invalid = sqm === null;
  const number = (value: number) =>
    new Intl.NumberFormat(locale === "ne" ? "ne-NP" : "en-NP", {
      numberingSystem: locale === "ne" ? "deva" : "latn",
      ...(value !== 0 && value < 1e-6
        ? { maximumSignificantDigits: 8 }
        : { maximumFractionDigits: 6 }),
    }).format(value);
  function changeSystem(next: InputSystem) {
    if (sqm !== null) {
      if (next === "single") setAmount(String(sqm / NEPALI_AREA_IN_SQM[unit]));
      else setParts(nepaliAreaParts(sqm, next).map(String));
    } else if (next !== "single")
      setParts(NEPALI_AREA_SYSTEMS[next].map(() => "0"));
    setSystem(next);
  }
  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <div className="grid gap-px bg-ink-200 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-5 bg-white p-5 sm:p-7">
          <Field
            label={text("Area input system", "क्षेत्रफल राख्ने प्रणाली")}
            htmlFor="area-input-system"
          >
            <Select
              id="area-input-system"
              value={system}
              onChange={(event) =>
                changeSystem(event.target.value as InputSystem)
              }
            >
              <option value="single">{text("Single unit", "एउटा एकाइ")}</option>
              <option value="ropani">
                {text("Ropani–Aana–Paisa–Daam", "रोपनी–आना–पैसा–दाम")}
              </option>
              <option value="bigha">
                {text("Bigha–Kattha–Dhur", "बिघा–कट्ठा–धुर")}
              </option>
            </Select>
          </Field>
          {system === "single" ? (
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <Field label={t.plotSize} htmlFor="area-amount">
                <Input
                  id="area-amount"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  aria-invalid={invalid}
                  aria-describedby="area-input-help area-converter-error"
                  className="px-3 tabular-nums"
                />
              </Field>
              <Field label={t.unit} htmlFor="area-unit">
                <Select
                  id="area-unit"
                  value={unit}
                  onChange={(event) =>
                    setUnit(event.target.value as NepaliAreaUnit)
                  }
                >
                  {INPUT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {t.units[u]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-2 gap-3">
              {NEPALI_AREA_SYSTEMS[system].map((u, index) => (
                <Field key={u} label={t.units[u]} htmlFor={"area-" + u}>
                  <Input
                    id={"area-" + u}
                    type="text"
                    inputMode="decimal"
                    value={parts[index] ?? ""}
                    onChange={(event) =>
                      setParts(
                        parts.map((value, i) =>
                          i === index ? event.target.value : value,
                        ),
                      )
                    }
                    aria-invalid={invalid}
                    aria-describedby="area-input-help area-converter-error"
                    className="px-3 tabular-nums"
                  />
                </Field>
              ))}
            </div>
          )}
          <p
            id="area-input-help"
            className="text-xs leading-relaxed text-ink-600"
          >
            {system === "single"
              ? text(
                  "Enter English or Nepali digits, for example 4.5 or ४.५.",
                  "अङ्ग्रेजी वा नेपाली अङ्क राख्नुहोस्, जस्तै 4.5 वा ४.५।",
                )
              : text(
                  "Use 0 for unused units. Larger units are whole numbers; daam or dhur can be fractional. Extra units carry automatically.",
                  "प्रयोग नभएको एकाइमा ० राख्नुहोस्। ठूला एकाइ पूर्णाङ्क र दाम वा धुर दशमलव हुन सक्छन्। बढी एकाइ अर्को एकाइमा आफैँ सर्छ।",
                )}
          </p>
          <p
            id="area-converter-error"
            role={invalid ? "alert" : undefined}
            className="text-sm leading-relaxed text-crimson-700"
          >
            {invalid
              ? text(
                  "Enter complete, nonnegative numbers. Only the last combined unit can be fractional. Maximum area: 10¹⁵ m².",
                  "पूर्ण र शून्य वा सोभन्दा ठूला सङ्ख्या राख्नुहोस्। मिश्रित ढाँचामा अन्तिम एकाइ मात्र दशमलव हुन सक्छ। अधिकतम क्षेत्रफल: १०¹⁵ वर्ग मिटर।",
                )
              : ""}
          </p>
          <dl
            aria-live="polite"
            className="space-y-3 border-t border-ink-200 pt-4 text-sm tabular-nums"
          >
            {[
              [
                t.squareFeet,
                sqm === null ? "—" : number(sqm / NEPALI_AREA_IN_SQM.sqft),
              ],
              [t.squareMetres, sqm === null ? "—" : number(sqm)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-wrap items-baseline justify-between gap-3"
              >
                <dt className="text-ink-600">{label}</dt>
                <dd className="font-semibold text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="min-w-0 bg-white p-5 sm:p-7" aria-live="polite">
          {sqm !== null ? (
            <NepaliAreaResults sqm={sqm} />
          ) : (
            <p className="text-sm leading-relaxed text-ink-600">
              {text(
                "Correct the area inputs to see both Nepali systems.",
                "दुवै नेपाली प्रणाली हेर्न क्षेत्रफलको मापन सच्याउनुहोस्।",
              )}
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-ink-600">
            {text(
              "1 ropani = 16 aana; 1 aana = 4 paisa; 1 paisa = 4 daam. 1 bigha = 20 kattha; 1 kattha = 20 dhur.",
              "१ रोपनी = १६ आना; १ आना = ४ पैसा; १ पैसा = ४ दाम। १ बिघा = २० कट्ठा; १ कट्ठा = २० धुर।",
            )}
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/#rentals">
              {ui.browse}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
