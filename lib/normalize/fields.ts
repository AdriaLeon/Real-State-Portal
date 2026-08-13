// Small, pure, unit-testable parsers/mappers for individual field values
// pulled out of the label->value attribute map (see attributes.ts).
//
// All numeric fields on sprzedajemy.pl are confirmed dot-decimal
// (e.g. "51.3 m²", not "51,3 m²") across all 105 raw fixtures, despite
// Polish convention normally using a comma — so no locale-aware parsing is
// needed here.

// "51.3 m²" -> 51.3
export function parseArea(raw: string): number {
  const num = parseFloat(raw.replace(/[^\d.]/g, ""));
  if (Number.isNaN(num)) throw new Error(`Cannot parse area from "${raw}"`);
  return num;
}

// "15100 zł/m²" -> 15100, "774 630 zł" -> 774630
export function parsePrice(raw: string): number {
  const num = parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(num)) throw new Error(`Cannot parse price from "${raw}"`);
  return num;
}

// "parter" -> 0 (ground floor), "1" -> 1, "10" -> 10
export function parseFloor(raw: string): number {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "parter") return 0;
  const num = parseInt(trimmed, 10);
  if (Number.isNaN(num)) throw new Error(`Cannot parse floor from "${raw}"`);
  return num;
}

//"3 piętra i więcej" -> 3, "5" -> 5. Returns null for unparseable/absent input.
export function parseTotalFloors(raw: string | undefined): number | null {
  if (!raw) return null;
  const num = parseInt(raw, 10);
  return Number.isNaN(num) ? null : num;
}

// "2019" -> 2019. Returns null for unparseable/absent input.
export function parseYearBuilt(raw: string | undefined): number | null {
  if (!raw) return null;
  const num = parseInt(raw, 10);
  return Number.isNaN(num) ? null : num;
}


// Strips the "Mieszkania na sprzedaż {city} " prefix from the last
// breadcrumb crumb to recover the district, e.g.
//   parseDistrict("Mieszkania na sprzedaż Kraków Płaszów", "Kraków") -> "Płaszów"
//   parseDistrict("Mieszkania na sprzedaż Kraków", "Kraków") -> null (city-wide, no district)

export function parseDistrict(breadcrumbLast: string | null, city: string): string | null {
  if (!breadcrumbLast) return null;
  const prefix = `Mieszkania na sprzedaż ${city} `;
  if (!breadcrumbLast.startsWith(prefix)) return null;
  const rest = breadcrumbLast.slice(prefix.length).trim();
  return rest.length > 0 ? rest : null;
}

// "wtórny" -> "secondary", "pierwotny" -> "primary"
export function mapMarketType(raw: string | undefined): "primary" | "secondary" {
  const trimmed = raw?.trim().toLowerCase();
  if (trimmed === "pierwotny") return "primary";
  if (trimmed === "wtórny") return "secondary";
  console.warn(`Unrecognized market type "${raw}", defaulting to "secondary"`);
  return "secondary";
}

// "osoby prywatnej" -> "private", "firmy" -> "agency" 
export function mapSellerType(raw: string | undefined): "private" | "agency" {
  const trimmed = raw?.trim().toLowerCase();
  if (trimmed === "osoby prywatnej") return "private";
  if (trimmed === "firmy") return "agency";
  console.warn(`Unrecognized seller type "${raw}", defaulting to "agency"`);
  return "agency";
}

// Passes the building type through as-is (blok / apartamentowiec / kamienica / plomba / ...).
export function mapBuildingType(raw: string | undefined): string | null {
  return raw?.trim() || null;
}


// PLN/m² floor below which a "for sale" listing is almost certainly a
// rental ad misfiled under the sale search (its "price" is a monthly rent
// figure, not a sale price). Chosen from the observed data: every genuine
// sale listing in our 105-listing fixture sits at 9,000+ PLN/m²; the one
// confirmed rental outlier sat at 51 PLN/m². See REASONING.md.

export const MIN_PLAUSIBLE_SALE_PRICE_PER_M2 = 1000;

// True if `pricePerM2` is high enough to plausibly be a sale price (not a rent price).
export function isPlausibleSalePrice(pricePerM2: number): boolean {
  return pricePerM2 >= MIN_PLAUSIBLE_SALE_PRICE_PER_M2;
}
