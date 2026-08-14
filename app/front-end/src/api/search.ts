import { apiGet } from "./client";
import type { SortBy, SortOrder } from "../types/filters";
import type { SearchMode, SearchResult } from "../types/search";

export interface SearchParams {
  page?: number;
  limit?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  mode?: SearchMode;
}

// GET /search — mirrors app/api/routes/search.ts (repo root). The backend
// parses `q` into structured filters (city, district, amenities, elevator,
// seller/market type, price & area bands). `signal` lets a caller cancel a
// superseded request (see ListingsPage.tsx).
export function search(q: string, params: SearchParams = {}, signal?: AbortSignal): Promise<SearchResult> {
  return apiGet<SearchResult>("/search", { q, ...params } as Record<string, unknown>, signal);
}
