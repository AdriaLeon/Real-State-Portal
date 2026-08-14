// Turns search query params into Prisma `where`/`orderBy` clauses for the
// Listing model. Pure and framework-agnostic (takes a plain query object,
// not an Express Request) so it's unit-testable without a server.

import { MarketType, type Prisma, SellerType } from "../../generated/prisma/client.js";
import { parseBooleanParam, parseEnumParam, parseFloatParam, parseIntParam, parseStringParam, QueryParamError } from "./queryParams.js";

type Query = Record<string, unknown>;

const MARKET_TYPES = Object.values(MarketType);
const SELLER_TYPES = Object.values(SellerType);
const SORT_BY_VALUES = ["newest", "price", "area"] as const;
const SORT_ORDER_VALUES = ["asc", "desc"] as const;

type SortBy = (typeof SORT_BY_VALUES)[number];
type SortOrder = (typeof SORT_ORDER_VALUES)[number];

// Adds a { gte, lte } range clause for `field`, or omits it entirely if
// neither bound is present. Throws if the caller passes min > max — that's
// very likely a UI/client bug, and silently returning zero rows would hide it.
function addRange(where: Record<string, { gte?: number; lte?: number }>, field: string, min: number | undefined, max: number | undefined) {
  if (min === undefined && max === undefined) return;
  if (min !== undefined && max !== undefined && min > max) {
    throw new QueryParamError(`min${capitalize(field)} (${min}) must not be greater than max${capitalize(field)} (${max})`);
  }
  const range: { gte?: number; lte?: number } = {};
  if (min !== undefined) range.gte = min;
  if (max !== undefined) range.lte = max;
  where[field] = range;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildListingWhere(query: Query): Prisma.ListingWhereInput {
  const where: Prisma.ListingWhereInput = {};

  const city = parseStringParam(query.city, "city");
  if (city !== undefined) where.city = { equals: city };

  const district = parseStringParam(query.district, "district");
  if (district !== undefined) where.district = { equals: district };

  const buildingType = parseStringParam(query.buildingType, "buildingType");
  if (buildingType !== undefined) where.buildingType = { equals: buildingType };

  const ownershipForm = parseStringParam(query.ownershipForm, "ownershipForm");
  if (ownershipForm !== undefined) where.ownershipForm = { equals: ownershipForm };

  const marketType = parseEnumParam(query.marketType, "marketType", MARKET_TYPES);
  if (marketType !== undefined) where.marketType = marketType;

  const sellerType = parseEnumParam(query.sellerType, "sellerType", SELLER_TYPES);
  if (sellerType !== undefined) where.sellerType = sellerType;

  const hasElevator = parseBooleanParam(query.hasElevator, "hasElevator");
  if (hasElevator !== undefined) where.hasElevator = hasElevator;

  const minPrice = parseIntParam(query.minPrice, "minPrice");
  const maxPrice = parseIntParam(query.maxPrice, "maxPrice");
  addRange(where as Record<string, { gte?: number; lte?: number }>, "price", minPrice, maxPrice);

  const minArea = parseFloatParam(query.minArea, "minArea");
  const maxArea = parseFloatParam(query.maxArea, "maxArea");
  addRange(where as Record<string, { gte?: number; lte?: number }>, "area", minArea, maxArea);

  const minRooms = parseIntParam(query.minRooms, "minRooms");
  const maxRooms = parseIntParam(query.maxRooms, "maxRooms");
  addRange(where as Record<string, { gte?: number; lte?: number }>, "rooms", minRooms, maxRooms);

  return where;
}

export function buildListingOrderBy(query: Query): Prisma.ListingOrderByWithRelationInput {
  const sortBy = parseEnumParam(query.sortBy, "sortBy", SORT_BY_VALUES) ?? "newest";
  const sortOrder = parseEnumParam(query.sortOrder, "sortOrder", SORT_ORDER_VALUES) ?? "desc";
  return { [sortByToField(sortBy)]: sortOrder };
}

// "newest" sorts by createdAt (when the row entered our DB — buyer-relevant
// "recently added"), not fetchedAt/normalizedAt (pipeline timing).
function sortByToField(sortBy: SortBy): "createdAt" | "price" | "area" {
  if (sortBy === "newest") return "createdAt";
  return sortBy;
}
