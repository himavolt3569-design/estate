"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import type { PlaceResult } from "@/lib/place-search";
import { useSiteText } from "./site-language";

export function ListingLocationSearch({
  onSelect,
}: {
  onSelect: (place: PlaceResult) => void;
}) {
  const t = useSiteText();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<
    "idle" | "loading" | "results" | "empty" | "error" | "selected"
  >("idle");
  const active = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLButtonElement>(null);
  useEffect(() => () => active.current?.abort(), []);

  const search = async () => {
    active.current?.abort();
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    active.current = controller;
    setStatus("loading");
    setResults([]);
    try {
      const response = await fetch(
        `/api/places?q=${encodeURIComponent(query.trim())}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error("Location search failed");
      const places = (await response.json()) as PlaceResult[];
      if (controller.signal.aborted) return;
      setResults(places);
      setStatus(places.length ? "results" : "empty");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  };

  return (
    <div className="mb-5 rounded-xl border border-royal-100 bg-royal-50/40 p-4">
      <Field
        label={t("Search for a location", "स्थान खोज्नुहोस्")}
        htmlFor="place-search"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="place-search"
            value={query}
            maxLength={160}
            autoComplete="off"
            placeholder={t(
              "e.g. CIWC Hospital, Kathmandu",
              "जस्तै: CIWC Hospital, Kathmandu",
            )}
            aria-describedby="place-search-help place-search-status"
            aria-controls="place-search-results"
            onChange={(event) => {
              active.current?.abort();
              setQuery(event.target.value);
              setResults([]);
              setStatus("idle");
            }}
            onKeyDown={(event) => {
              // Enter may confirm an IME character instead of submitting a search.
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
              if (event.key === "ArrowDown" && results.length) {
                event.preventDefault();
                resultRef.current?.focus();
              }
              if (event.key === "Escape") {
                active.current?.abort();
                setResults([]);
                setStatus("idle");
              }
            }}
          />
          <Button
            type="button"
            variant="royal"
            className="shrink-0"
            disabled={status === "loading" || query.trim().length < 2}
            onClick={() => void search()}
          >
            {status === "loading" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <Search aria-hidden />
            )}
            {t("Search location", "स्थान खोज्नुहोस्")}
          </Button>
        </div>
      </Field>
      <p
        id="place-search-help"
        className="mt-2 text-xs leading-relaxed text-ink-500"
      >
        {t(
          "Search a place, hospital, school or area in Nepal. Choose a result to fill the address, nearby landmark and map pin. You can edit them below.",
          "नेपालको ठाउँ, अस्पताल, विद्यालय वा क्षेत्र खोज्नुहोस्। नतिजा छानेपछि ठेगाना, नजिकको चिनारी र नक्साको पिन भरिन्छन्। तल सम्पादन गर्न सक्नुहुन्छ।",
        )}
      </p>
      <p
        id="place-search-status"
        role="status"
        className="mt-2 text-sm text-ink-600"
      >
        {status === "loading" && t("Searching places…", "स्थान खोजिँदैछ…")}
        {status === "results" &&
          t(
            `${results.length} locations found. Choose the right one.`,
            `${results.length} स्थान भेटिए। सही स्थान छान्नुहोस्।`,
          )}
        {status === "empty" &&
          t(
            "No places found. Try a different spelling or add the city, or enter the address below.",
            "स्थान भेटिएन। अर्को हिज्जे वा सहर थपेर खोज्नुहोस्, वा तल ठेगाना लेख्नुहोस्।",
          )}
        {status === "error" &&
          t(
            "Location search is unavailable. Try again or enter the address below.",
            "स्थान खोजी उपलब्ध छैन। फेरि प्रयास गर्नुहोस् वा तल ठेगाना लेख्नुहोस्।",
          )}
        {status === "selected" &&
          t(
            "Address, nearby landmark and map pin filled. Review them below.",
            "ठेगाना, नजिकको चिनारी र नक्साको पिन भरिए। तल जाँच्नुहोस्।",
          )}
      </p>
      <ul
        id="place-search-results"
        aria-label={t("Location results", "स्थानका नतिजा")}
        className="max-h-72 space-y-1 overflow-y-auto"
      >
        {results.map((place, index) => (
          <li key={place.id}>
            <button
              ref={index === 0 ? resultRef : undefined}
              type="button"
              className="flex w-full items-start gap-3 rounded-lg border border-ink-100 bg-white p-3 text-left hover:border-royal-300 focus-visible:outline-2 focus-visible:outline-royal-600"
              onClick={() => {
                onSelect(place);
                setQuery(place.name);
                setResults([]);
                setStatus("selected");
                document.getElementById("address")?.focus();
              }}
            >
              <MapPin
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-royal-600"
              />
              <span className="min-w-0 break-words">
                <span className="block text-sm font-medium text-ink-900">
                  {place.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-500">
                  {place.address}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-400">
        {t("Place data:", "स्थानको तथ्याङ्क:")}{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
