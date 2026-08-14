export interface ListingLocation {
  city: string;
  district: string | null;
}

export interface ListingSize {
  area: number;
  rooms: number;
}

// Mirrors lib/api/listingDto.ts ListingSummaryDto (repo root) — the shape
// returned by GET /listings and GET /search list results.
export interface ListingSummaryDto {
  id: string;
  image: string | null;
  price: number;
  location: ListingLocation;
  size: ListingSize;
}

// Mirrors lib/api/listingDto.ts ListingDetailDto — the shape returned by
// GET /listings/:id. Not consumed by the home page yet, but defined now so
// the future listing detail page doesn't need a second pass through
// src/types/.
export interface ListingDetailDto {
  id: string;
  source: string;
  url: string;
  title: string;
  description: string;
  city: string;
  district: string | null;
  price: number;
  pricePerM2: number;
  isNegotiable: boolean;
  area: number;
  rooms: number;
  floor: number;
  totalFloors: number | null;
  yearBuilt: number | null;
  marketType: string;
  buildingType: string | null;
  ownershipForm: string | null;
  heating: string | null;
  sellerType: string;
  hasElevator: boolean;
  amenities: string[];
  images: string[];
  imageCount: number;
  aiSummary: string | null;
  fetchedAt: string;
  normalizedAt: string;
  createdAt: string;
  updatedAt: string;
}
