// Mirrors lib/api/listingFacets.ts ListingFacets (repo root) — the shape
// returned by GET /listings/facets, used to populate filter dropdowns with
// the values actually present in the data.
export interface ListingFacets {
  cities: string[];
  districts: string[];
  buildingTypes: string[];
  ownershipForms: string[];
}
