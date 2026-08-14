import { apiGet } from "./client";
import type { SortBy, SortOrder } from "../types/filters";
import type { SearchResult } from "../types/search";

export interface SearchParams {
  page?: number;
  limit?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}

// GET /search — mirrors app/api/routes/search.ts (repo root). The backend
// parses `q` into structured filters (city, district, amenities, elevator,
// seller/market type, price & area bands) and applies them to the same
// where-clause /listings uses, so `data` is already fully filtered;
// `detected` just echoes back what was recognized, for display.
export function search(q: string, params: SearchParams = {}): Promise<SearchResult> {
  return apiGet<SearchResult>("/search", { q, ...params } as Record<string, unknown>);
}
