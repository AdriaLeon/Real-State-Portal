import { describe, expect, it } from "vitest";
import { buildListingOrderBy, buildListingWhere } from "../../lib/api/listingFilters.js";
import { QueryParamError } from "../../lib/api/queryParams.js";

describe("buildListingWhere", () => {
  it("returns an empty where clause when no filters are given", () => {
    expect(buildListingWhere({})).toEqual({});
  });

  it("maps exact-match string filters", () => {
    expect(buildListingWhere({ city: "Kraków", district: "Płaszów" })).toEqual({
      city: { equals: "Kraków" },
      district: { equals: "Płaszów" },
    });
  });

  it("maps enum filters", () => {
    expect(buildListingWhere({ marketType: "primary", sellerType: "agency" })).toEqual({
      marketType: "primary",
      sellerType: "agency",
    });
  });

  it("maps the boolean filter", () => {
    expect(buildListingWhere({ hasElevator: "true" })).toEqual({ hasElevator: true });
  });

  it("maps price/area/rooms ranges", () => {
    expect(
      buildListingWhere({
        minPrice: "400000",
        maxPrice: "900000",
        minArea: "40",
        maxArea: "80.5",
        minRooms: "2",
        maxRooms: "4",
      }),
    ).toEqual({
      price: { gte: 400000, lte: 900000 },
      area: { gte: 40, lte: 80.5 },
      rooms: { gte: 2, lte: 4 },
    });
  });

  it("supports a one-sided range", () => {
    expect(buildListingWhere({ minPrice: "400000" })).toEqual({ price: { gte: 400000 } });
  });

  it("combines multiple filters", () => {
    expect(buildListingWhere({ city: "Kraków", minRooms: "3", hasElevator: "false" })).toEqual({
      city: { equals: "Kraków" },
      rooms: { gte: 3 },
      hasElevator: false,
    });
  });

  it("throws when min exceeds max", () => {
    expect(() => buildListingWhere({ minPrice: "900000", maxPrice: "500000" })).toThrow(QueryParamError);
  });

  it("throws on an invalid enum value", () => {
    expect(() => buildListingWhere({ marketType: "rental" })).toThrow(QueryParamError);
  });
});

describe("buildListingOrderBy", () => {
  it("defaults to newest first", () => {
    expect(buildListingOrderBy({})).toEqual({ createdAt: "desc" });
  });

  it("sorts by price ascending", () => {
    expect(buildListingOrderBy({ sortBy: "price", sortOrder: "asc" })).toEqual({ price: "asc" });
  });

  it("sorts by area descending", () => {
    expect(buildListingOrderBy({ sortBy: "area", sortOrder: "desc" })).toEqual({ area: "desc" });
  });

  it("throws on an invalid sortBy value", () => {
    expect(() => buildListingOrderBy({ sortBy: "popularity" })).toThrow(QueryParamError);
  });
});
