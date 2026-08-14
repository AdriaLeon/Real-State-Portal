// Shapes Prisma Listing rows into API response DTOs. Pure functions, kept
// separate from the route handlers so they're unit-testable without a DB.

import type { Listing } from "../../generated/prisma/client.js";

// Json columns come back from Prisma already deserialized but typed as the
// broad JsonValue union — narrow defensively instead of trusting the column
// always holds a string[] (e.g. a legacy/malformed row).
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export interface ListingSummaryDto {
  id: string;
  image: string | null;
  price: number;
  location: { city: string; district: string | null };
  size: { area: number; rooms: number };
}

// Search/list view: only the key data needed for a result card — one
// picture, price, location, and size — per the product requirement.
export function toListingSummaryDto(listing: Listing): ListingSummaryDto {
  const images = asStringArray(listing.images);
  return {
    id: listing.sourceId,
    image: images[0] ?? null,
    price: listing.price,
    location: { city: listing.city, district: listing.district },
    size: { area: listing.area, rooms: listing.rooms },
  };
}

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

// Single-listing view: the full row, JSON columns turned into real arrays.
// Excludes contentHash (internal change-detection bookkeeping, not
// buyer-facing) and renames AI_resume -> aiSummary for consistent camelCase.
export function toListingDetailDto(listing: Listing): ListingDetailDto {
  return {
    id: listing.sourceId,
    source: listing.source,
    url: listing.url,
    title: listing.title,
    description: listing.description,
    city: listing.city,
    district: listing.district,
    price: listing.price,
    pricePerM2: listing.pricePerM2,
    isNegotiable: listing.isNegotiable,
    area: listing.area,
    rooms: listing.rooms,
    floor: listing.floor,
    totalFloors: listing.totalFloors,
    yearBuilt: listing.yearBuilt,
    marketType: listing.marketType,
    buildingType: listing.buildingType,
    ownershipForm: listing.ownershipForm,
    heating: listing.heating,
    sellerType: listing.sellerType,
    hasElevator: listing.hasElevator,
    amenities: asStringArray(listing.amenities),
    images: asStringArray(listing.images),
    imageCount: listing.imageCount,
    aiSummary: listing.AI_resume,
    fetchedAt: listing.fetchedAt.toISOString(),
    normalizedAt: listing.normalizedAt.toISOString(),
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}
