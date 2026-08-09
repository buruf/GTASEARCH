// Assigns a Toronto business to one of the city's four districts:
// Toronto, Scarborough, Etobicoke or North York.
//
// WHY THIS FILE EXISTS. Toronto amalgamated in 1998, so there is exactly one
// City of Toronto and every open-data record says "TORONTO" regardless of
// whether the address is in Scarborough or the Financial District. Nobody
// publishes the split. But people emphatically still use these names — a
// Scarborough resident searching for a dentist does not think of themselves
// as searching Toronto — so the directory has to derive it.
//
// TWO METHODS, because the sources carry different evidence:
//
//   1. POSTAL FSA (preferred). The business-licence feed has a postal code on
//      effectively every row, and the first three characters — the Forward
//      Sortation Area — are exactly how Canada Post and Torontonians define
//      these areas. This is a lookup, not an inference.
//
//   2. WARD POLYGON (fallback). The public-health feeds (BodySafe, ChildCare)
//      carry no postal code but do carry GeoJSON coordinates, so those rows
//      are placed by point-in-polygon against the City's 25 ward boundaries,
//      whose names name their district ("Scarborough Centre", "Etobicoke
//      North", "Willowdale").
//
// WHERE THIS IS APPROXIMATE, stated plainly rather than hidden: ward
// boundaries are political and redrawn periodically, and they do not follow
// the pre-amalgamation municipal lines exactly — Ward 8 (Eglinton-Lawrence)
// straddles old Toronto and North York, for instance. FSAs are stable and
// far closer to how people actually use these names, which is why they are
// preferred wherever a postal code exists. A row that neither method can
// place stays "toronto", which is always literally true.
//
// EAST YORK and YORK were also pre-amalgamation municipalities, but the
// directory deliberately keeps only four districts, so their FSAs map to
// "toronto".

export type TorontoDistrict = "toronto" | "scarborough" | "etobicoke" | "north-york";

/**
 * FSA (first three characters of a postal code) -> district.
 *
 * Sourced from the published M-postal-code list. Only FSAs that genuinely sit
 * in a named district are listed; everything else — old Toronto, East York,
 * York, and the government block M7A — falls through to "toronto".
 *
 * Note the deliberately awkward cases, which are why this is a full FSA table
 * and not a "first character" shortcut:
 *   - M4A (Victoria Village) is NORTH YORK despite every other M4 being
 *     Toronto or East York.
 *   - M6A/M6B/M6L (Lawrence Heights, Glencairn, Downsview) are NORTH YORK
 *     while the rest of M6 is York or west-end Toronto.
 *   - M9L/M9M (Humber Summit, Emery) are NORTH YORK and M9N (Weston) is YORK,
 *     while every other M9 is ETOBICOKE.
 */
const FSA_DISTRICT: Record<string, TorontoDistrict> = {};

for (const fsa of [
  "M1B", "M1C", "M1E", "M1G", "M1H", "M1J", "M1K", "M1L", "M1M",
  "M1N", "M1P", "M1R", "M1S", "M1T", "M1V", "M1W", "M1X",
]) FSA_DISTRICT[fsa] = "scarborough";

for (const fsa of [
  "M8V", "M8W", "M8X", "M8Y", "M8Z",
  "M9A", "M9B", "M9C", "M9P", "M9R", "M9V", "M9W",
]) FSA_DISTRICT[fsa] = "etobicoke";

for (const fsa of [
  "M2H", "M2J", "M2K", "M2L", "M2M", "M2N", "M2P", "M2R",
  "M3A", "M3B", "M3C", "M3H", "M3J", "M3K", "M3L", "M3M", "M3N",
  "M4A", // Victoria Village — the lone M4 in North York
  "M6A", "M6B", "M6L", // Lawrence Heights, Glencairn, Downsview
  "M9L", "M9M", // Humber Summit, Emery — the M9s that are NOT Etobicoke
]) FSA_DISTRICT[fsa] = "north-york";

/** Reads the FSA out of anything postal-code-shaped and maps it. */
export function districtFromPostal(postal: string | null | undefined): TorontoDistrict {
  if (!postal) return "toronto";
  const m = String(postal).toUpperCase().match(/[A-Z]\d[A-Z]/);
  if (!m) return "toronto";
  return FSA_DISTRICT[m[0]] ?? "toronto";
}

/**
 * Ward name -> district, for the coordinate fallback. Keyed on the substrings
 * the City uses in its own ward names; the four Toronto/East York/York wards
 * are absent on purpose and fall through to "toronto".
 */
const WARD_NAME_DISTRICT: [RegExp, TorontoDistrict][] = [
  [/scarborough/i, "scarborough"],
  [/etobicoke/i, "etobicoke"],
  [/york centre|humber river|willowdale|don valley/i, "north-york"],
];

export function districtFromWardName(wardName: string | null | undefined): TorontoDistrict {
  if (!wardName) return "toronto";
  for (const [re, district] of WARD_NAME_DISTRICT) {
    if (re.test(wardName)) return district;
  }
  return "toronto";
}

export interface WardPolygon {
  name: string;
  district: TorontoDistrict;
  /** Rings of [lng, lat] pairs. */
  rings: [number, number][][];
  bbox: [number, number, number, number]; // minLng, minLat, maxLng, maxLat
}

/**
 * Standard ray-casting point-in-polygon. The bounding box is checked first —
 * with 25 wards tested against thousands of points, that rejection is what
 * keeps this from being the slow part of an import.
 */
function pointInRings(lng: number, lat: number, poly: WardPolygon): boolean {
  const [minLng, minLat, maxLng, maxLat] = poly.bbox;
  if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;

  let inside = false;
  for (const ring of poly.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersects =
        yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersects) inside = !inside;
    }
  }
  return inside;
}

export function districtFromPoint(
  lng: number,
  lat: number,
  polygons: WardPolygon[],
): TorontoDistrict | null {
  for (const poly of polygons) {
    if (pointInRings(lng, lat, poly)) return poly.district;
  }
  return null;
}

/** Loads the City's 25 ward boundaries and flattens them for lookup. */
export async function loadWardPolygons(): Promise<WardPolygon[]> {
  const url =
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search" +
    "?resource_id=7672dac5-b383-4d7c-90ec-291dc69d37bf&limit=50";
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  const json = (await res.json()) as {
    result: { records: { AREA_NAME: string; geometry: string }[] };
  };

  const polys: WardPolygon[] = [];
  for (const rec of json.result.records) {
    if (!rec.geometry) continue;
    const geo = JSON.parse(rec.geometry) as {
      type: string;
      coordinates: number[][][] | number[][][][];
    };
    // Wards come as Polygon or MultiPolygon; normalise both to a ring list.
    const rings: [number, number][][] =
      geo.type === "MultiPolygon"
        ? (geo.coordinates as number[][][][]).flatMap((p) => p as [number, number][][])
        : (geo.coordinates as [number, number][][]);

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }

    polys.push({
      name: rec.AREA_NAME,
      district: districtFromWardName(rec.AREA_NAME),
      rings,
      bbox: [minLng, minLat, maxLng, maxLat],
    });
  }
  return polys;
}
