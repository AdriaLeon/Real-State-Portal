export type MarketType = "primary" | "secondary";
export type SellerType = "private" | "agency";
export type SortBy = "newest" | "price" | "area";
export type SortOrder = "asc" | "desc";

// Mirrors the GET /listings query params
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
