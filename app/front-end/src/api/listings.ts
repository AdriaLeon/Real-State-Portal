import { apiGet } from "./client";
import type { ListingFilters } from "../types/filters";
import type { ListingSummaryDto } from "../types/listing";
import type { Paginated } from "../types/pagination";

// GET /listings — mirrors app/api/routes/listing.ts (repo root). `filters`
// maps 1:1 onto backend query params, so it's passed straight through.
export function getListings(filters: ListingFilters = {}): Promise<Paginated<ListingSummaryDto>> {
  return apiGet<Paginated<ListingSummaryDto>>("/listings", filters as Record<string, unknown>);
}
