import type { MarketType, SellerType } from "./filters";
import type { ListingSummaryDto } from "./listing";
import type { PaginationMeta } from "./pagination";

// What mode="keyword" (regex/vocabulary matching) can detect — narrower
// than AIDetectedFilters below. See lib/api/searchQueryParser.ts.
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

// What mode="ai" can detect — the full filter set FilterPanel offers
// (building type, ownership form, numeric price/area/room ranges), not
// just the narrow keyword-parser subset. See lib/ai/searchQueryAI.ts.
export interface AIDetectedFilters {
  city: string | null;
  district: string | null;
  buildingType: string | null;
  ownershipForm: string | null;
  marketType: MarketType | null;
  sellerType: SellerType | null;
  hasElevator: boolean;
  amenities: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  minRooms: number | null;
  maxRooms: number | null;
}

// "keyword" = regex/vocabulary matching, "ai" = Gemini-based extraction —
export type SearchMode = "keyword" | "ai";

export interface SearchResult {
  data: ListingSummaryDto[];
  pagination: PaginationMeta;
  detected: DetectedFilters | AIDetectedFilters;
  mode: SearchMode;
  warning: string | null;
}