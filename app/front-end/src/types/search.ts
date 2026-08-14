import type { MarketType, SellerType } from "./filters";
import type { ListingSummaryDto } from "./listing";
import type { PaginationMeta } from "./pagination";

export interface DetectedFilters {
  city: string | null;
  district: string | null;
  amenities: string[];
  hasElevator: boolean;
  sellerType: SellerType | null;
  marketType: MarketType | null;
  priceBand: "cheap" | "expensive" | null;
  areaBand: "small" | "big" | null;
}

// Mirrors the GET /search response shape (app/api/routes/search.ts).
export interface SearchResult {
  data: ListingSummaryDto[];
  pagination: PaginationMeta;
  detected: DetectedFilters;
}