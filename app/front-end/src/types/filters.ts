export type MarketType = "primary" | "secondary";
export type SellerType = "private" | "agency";
export type SortBy = "newest" | "price" | "area";
export type SortOrder = "asc" | "desc";

// Mirrors the GET /listings query params (app/api/routes/listing.ts,
// lib/api/listingFilters.ts, lib/api/queryParams.ts, repo root). All
// optional — an absent field means "no filter", matching the backend's
// "unset param" semantics exactly (i.e. the default is "Any").
export interface ListingFilters {
  city?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  minRooms?: number;
  maxRooms?: number;
  marketType?: MarketType;
  sellerType?: SellerType;
  hasElevator?: boolean;
  buildingType?: string;
  ownershipForm?: string;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}
