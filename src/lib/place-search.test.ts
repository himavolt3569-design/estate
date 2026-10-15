import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizePlaces } from "./place-search";
import { GET } from "../app/api/places/route";

const hospital = {
  type: "Feature",
  properties: {
    osm_type: "N",
    osm_id: 1,
    countrycode: "NP",
    name: "CIWEC Hospital",
    street: "British-Indian Embassy Rd",
    locality: "Lainchaur",
    city: "Kathmandu",
    country: "Nepal",
  },
  geometry: { type: "Point", coordinates: [85.3178811, 27.7202714] },
};
const data = { type: "FeatureCollection", features: [hospital] };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("place search", () => {
  it("keeps the landmark name separate from its editable street address and coordinates", () => {
    expect(normalizePlaces(data)).toEqual([
      {
        id: "N-1",
        name: "CIWEC Hospital",
        address: "British-Indian Embassy Rd, Lainchaur, Kathmandu, Nepal",
        lat: 27.7202714,
        lng: 85.3178811,
      },
    ]);
  });

  it("rejects malformed, foreign and invalid-coordinate results and removes duplicates", () => {
    expect(
      normalizePlaces({
        features: [
          hospital,
          hospital,
          {},
          {
            ...hospital,
            properties: { ...hospital.properties, countrycode: "IN" },
          },
          { ...hospital, geometry: { type: "Point", coordinates: [200, 27] } },
          {
            ...hospital,
            geometry: { type: "Point", coordinates: ["85", "27"] },
          },
        ],
      }),
    ).toHaveLength(1);
    expect(() => normalizePlaces({})).toThrow("Invalid place search response");
  });

  it("returns validated search results and caches provider lookups", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => data });
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("GEOCODING_BASE_URL", "https://places.example.test/");
    const response = await GET(
      new Request("http://localhost/api/places?q=CIWC%20Hospital"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(normalizePlaces(data));
    const [url, options] = fetch.mock.calls[0]!;
    expect(url.origin).toBe("https://places.example.test");
    expect(url.searchParams.get("q")).toBe("CIWC Hospital");
    expect(url.searchParams.get("bbox")).toBe("80.0,26.3,88.3,30.5");
    expect(options.next.revalidate).toBe(86400);
  });

  it("does not contact the provider for invalid queries and distinguishes failure from no matches", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(
      (await GET(new Request("http://localhost/api/places?q=a"))).status,
    ).toBe(400);
    expect(
      (
        await GET(
          new Request(`http://localhost/api/places?q=${"x".repeat(161)}`),
        )
      ).status,
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ features: [] }),
    });
    expect(
      await (
        await GET(new Request("http://localhost/api/places?q=unknown"))
      ).json(),
    ).toEqual([]);
    fetch.mockResolvedValueOnce({ ok: false });
    expect(
      (await GET(new Request("http://localhost/api/places?q=CIWC"))).status,
    ).toBe(502);
    fetch.mockRejectedValueOnce(new Error("Timeout"));
    expect(
      (await GET(new Request("http://localhost/api/places?q=CIWC"))).status,
    ).toBe(502);
  });
});
