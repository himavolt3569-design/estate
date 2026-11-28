import { NextResponse } from "next/server";
import { normalizePlaces } from "../../../lib/place-search";

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

const RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=3600",
  "X-Content-Type-Options": "nosniff",
} as const;

function resolveGeocodingBaseUrl(): URL {
  const raw = process.env.GEOCODING_BASE_URL || "https://photon.komoot.io/";
  const parsed = new URL(raw);
  const isLoopback =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLoopback)) {
    throw new Error("Invalid geocoding provider protocol");
  }
  return parsed;
}

// Requests happen only on Search/Enter. Next caches identical provider lookups.
export async function GET(request: Request) {
  const rawQuery = new URL(request.url).searchParams.get("q") || "";
  const query = rawQuery.replace(CONTROL_CHARS_RE, " ").trim();
  if (query.length < 2 || query.length > 160)
    return NextResponse.json(
      { error: "Enter a location between 2 and 160 characters." },
      { status: 400, headers: { "X-Content-Type-Options": "nosniff" } },
    );
  try {
    const url = new URL("api/", resolveGeocodingBaseUrl());
    url.searchParams.set("q", query);
    url.searchParams.set("bbox", "80.0,26.3,88.3,30.5");
    url.searchParams.set("limit", "10");
    url.searchParams.set("lang", "en");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "HamroKotha-PropertySearch/1.0",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error("Place provider unavailable");
    return NextResponse.json(normalizePlaces(await response.json()), {
      headers: RESPONSE_HEADERS,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Location search is unavailable. Please try again or enter the address manually.",
      },
      { status: 502, headers: { "X-Content-Type-Options": "nosniff" } },
    );
  }
}
