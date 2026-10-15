import { NextResponse } from "next/server";
import { normalizePlaces } from "../../../lib/place-search";

// Requests happen only on Search/Enter. Next caches identical provider lookups.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2 || query.length > 160)
    return NextResponse.json(
      { error: "Enter a location between 2 and 160 characters." },
      { status: 400 },
    );
  try {
    const url = new URL(
      "api/",
      process.env.GEOCODING_BASE_URL || "https://photon.komoot.io/",
    );
    url.searchParams.set("q", query);
    url.searchParams.set("bbox", "80.0,26.3,88.3,30.5");
    url.searchParams.set("limit", "10");
    url.searchParams.set("lang", "en");
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MeroKotha-PropertySearch/1.0",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error("Place provider unavailable");
    return NextResponse.json(normalizePlaces(await response.json()), {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Location search is unavailable. Please try again or enter the address manually.",
      },
      { status: 502 },
    );
  }
}
