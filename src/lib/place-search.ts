export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

// Validate the provider boundary so malformed or non-Nepal results cannot move the pin.
export function normalizePlaces(data: unknown): PlaceResult[] {
  const features = record(data).features;
  if (!Array.isArray(features))
    throw new Error("Invalid place search response");
  const seen = new Set<string>();
  return features
    .flatMap((feature: unknown): PlaceResult[] => {
      const item = record(feature);
      const props = record(item.properties);
      const geometry = record(item.geometry);
      if (
        !Array.isArray(geometry.coordinates) ||
        geometry.type !== "Point" ||
        String(props.countrycode).toUpperCase() !== "NP"
      )
        return [];
      const [lng, lat] = geometry.coordinates;
      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < 26.3 ||
        lat > 30.5 ||
        lng < 80 ||
        lng > 88.3
      )
        return [];
      const text = (key: string) =>
        typeof props[key] === "string" ? props[key].trim() : "";
      const name = text("name") || text("street") || text("city");
      if (!name) return [];
      const id = `${String(props.osm_type || "place")}-${String(props.osm_id || `${lat},${lng}`)}`;
      if (seen.has(id)) return [];
      seen.add(id);
      const address = [
        ...new Set(
          [
            [text("housenumber"), text("street")].filter(Boolean).join(" "),
            text("locality") || text("suburb") || text("district"),
            text("city") || text("town") || text("village") || text("county"),
            text("state"),
            text("country"),
          ].filter(Boolean),
        ),
      ].join(", ");
      return [{ id, name, address: address || name, lat, lng }];
    })
    .slice(0, 6);
}
