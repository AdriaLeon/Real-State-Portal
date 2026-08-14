import { apiGet } from "./client";
import type { ListingFacets } from "../types/facets";
import type { ListingFilters } from "../types/filters";
import type { ListingDetailDto, ListingSummaryDto } from "../types/listing";
import type { Paginated } from "../types/pagination";

// GET /listings — mirrors app/api/routes/listing.ts (repo root). `filters`
// maps 1:1 onto backend query params, so it's passed straight through.
// `signal` lets a caller cancel a superseded request (see ListingsPage.tsx).
export function getListings(filters: ListingFilters = {}, signal?: AbortSignal): Promise<Paginated<ListingSummaryDto>> {
  return apiGet<Paginated<ListingSummaryDto>>("/listings", filters as Record<string, unknown>, signal);
}

// GET /listings/:id — id is the listing's sourceId (see ListingCard links).
export function getListing(id: string): Promise<ListingDetailDto> {
  return apiGet<ListingDetailDto>(`/listings/${encodeURIComponent(id)}`);
}

// GET /listings/facets — distinct city/district/buildingType/ownershipForm
// values, used to populate FilterPanel's dropdowns.
export function getListingFacets(): Promise<ListingFacets> {
  return apiGet<ListingFacets>("/listings/facets");
}
