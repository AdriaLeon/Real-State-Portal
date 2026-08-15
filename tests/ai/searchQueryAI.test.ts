import { describe, expect, it } from "vitest";
import { buildFilterExtractionPrompt, buildFilterSchema, sanitizeDetectedFilters, aiFiltersToWhere } from "../../lib/ai/searchQueryAI.js";
import type { ListingFacets } from "../../lib/api/listingFacets.js";
import type { MarketStats } from "../../lib/api/marketStats.js";

const facets: ListingFacets = {
  cities: ["Kraków", "Warszawa"],
  districts: ["Stare Miasto", "Centrum"],
  buildingTypes: ["apartment", "house"],
  ownershipForms: ["freehold", "cooperative"],
};

const stats: MarketStats = {
  price: { p25: 400000, p75: 800000 },
  area: { p25: 30, p75: 60 },
};

describe("buildFilterExtractionPrompt", () => {
  it("returns the input query unmodified", () => {
    const query = "a couple of rooms in Kraków";
    const { input } = buildFilterExtractionPrompt(query, facets, stats);
    expect(input).toBe(query);
  });

  it("includes the base system prompt with floor rules", () => {
    const { systemInstruction } = buildFilterExtractionPrompt("test", facets, stats);
    expect(systemInstruction).toContain("minFloor/maxFloor");
    expect(systemInstruction).toContain("Ground floor");
    expect(systemInstruction).toContain("parter");
  });

  it("includes vague-quantity rooms inference in the prompt", () => {
    const { systemInstruction } = buildFilterExtractionPrompt("test", facets, stats);
    expect(systemInstruction).toContain("a couple of rooms");
    expect(systemInstruction).toContain("minRooms=2");
    expect(systemInstruction).toContain("a few rooms");
    expect(systemInstruction).toContain("several rooms");
  });

  it("includes the general inference-license paragraph protecting closed vocabularies", () => {
    const { systemInstruction } = buildFilterExtractionPrompt("test", facets, stats);
    expect(systemInstruction).toContain("Beyond the specific rules above");
    expect(systemInstruction).toContain("numeric filters");
    expect(systemInstruction).toContain("city");
    expect(systemInstruction).toContain("district");
    expect(systemInstruction).toContain("buildingType");
    expect(systemInstruction).toContain("ownershipForm");
    expect(systemInstruction).toContain("amenities");
    expect(systemInstruction).toContain("closed vocabularies");
  });

  it("includes valid cities in the instruction", () => {
    const { systemInstruction } = buildFilterExtractionPrompt("test", facets, stats);
    expect(systemInstruction).toContain("Valid cities:");
    expect(systemInstruction).toContain("Kraków");
    expect(systemInstruction).toContain("Warszawa");
  });

  it("includes price and area percentiles", () => {
    const { systemInstruction } = buildFilterExtractionPrompt("test", facets, stats);
    expect(systemInstruction).toContain("Price percentiles");
    expect(systemInstruction).toContain("400000");
    expect(systemInstruction).toContain("800000");
    expect(systemInstruction).toContain("Area percentiles");
    expect(systemInstruction).toContain("30");
    expect(systemInstruction).toContain("60");
  });
});

describe("buildFilterSchema", () => {
  it("includes minFloor and maxFloor in properties", () => {
    const schema = buildFilterSchema(facets);
    expect(schema.properties).toHaveProperty("minFloor");
    expect(schema.properties).toHaveProperty("maxFloor");
  });

  it("includes minFloor and maxFloor in required fields", () => {
    const schema = buildFilterSchema(facets);
    expect(schema.required).toContain("minFloor");
    expect(schema.required).toContain("maxFloor");
  });

  it("defines minFloor and maxFloor as number or null", () => {
    const schema = buildFilterSchema(facets);
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const floorProp = props["minFloor"];
    expect(floorProp?.type).toEqual(["number", "null"]);
    const maxFloorProp = props["maxFloor"];
    expect(maxFloorProp?.type).toEqual(["number", "null"]);
  });

  it("has all 16 required fields including the new floor fields", () => {
    const schema = buildFilterSchema(facets);
    expect((schema.required as string[]).length).toBe(16);
    expect(schema.required).toEqual([
      "city",
      "district",
      "buildingType",
      "ownershipForm",
      "marketType",
      "sellerType",
      "hasElevator",
      "amenities",
      "minPrice",
      "maxPrice",
      "minArea",
      "maxArea",
      "minRooms",
      "maxRooms",
      "minFloor",
      "maxFloor",
    ]);
  });
});

describe("sanitizeDetectedFilters", () => {
  it("passes through valid minFloor/maxFloor", () => {
    const raw = {
      city: null,
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: false,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: null,
      maxRooms: null,
      minFloor: 2,
      maxFloor: 5,
    };
    const result = sanitizeDetectedFilters(raw, facets);
    expect(result.minFloor).toBe(2);
    expect(result.maxFloor).toBe(5);
  });

  it("clamps negative floor to null", () => {
    const raw = {
      city: null,
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: false,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: null,
      maxRooms: null,
      minFloor: -1,
      maxFloor: 5,
    };
    const result = sanitizeDetectedFilters(raw, facets);
    expect(result.minFloor).toBeNull();
    expect(result.maxFloor).toBe(5);
  });

  it("drops both floor bounds if min > max", () => {
    const raw = {
      city: null,
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: false,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: null,
      maxRooms: null,
      minFloor: 10,
      maxFloor: 5,
    };
    const result = sanitizeDetectedFilters(raw, facets);
    expect(result.minFloor).toBeNull();
    expect(result.maxFloor).toBeNull();
  });

  it("handles floor=0 correctly (ground floor)", () => {
    const raw = {
      city: null,
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: false,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: null,
      maxRooms: null,
      minFloor: 0,
      maxFloor: 0,
    };
    const result = sanitizeDetectedFilters(raw, facets);
    expect(result.minFloor).toBe(0);
    expect(result.maxFloor).toBe(0);
  });

  it("sanitizes all other fields as before (backward compatibility)", () => {
    const raw = {
      city: "Kraków",
      district: "Stare Miasto",
      buildingType: "apartment",
      ownershipForm: "freehold",
      marketType: "primary",
      sellerType: "agency",
      hasElevator: true,
      amenities: ["balkon", "invalid_amenity"],
      minPrice: 500000,
      maxPrice: 1000000,
      minArea: 50,
      maxArea: 120,
      minRooms: 2,
      maxRooms: 4,
      minFloor: 1,
      maxFloor: 3,
    };
    const result = sanitizeDetectedFilters(raw, facets);
    expect(result.city).toBe("Kraków");
    expect(result.district).toBe("Stare Miasto");
    expect(result.buildingType).toBe("apartment");
    expect(result.ownershipForm).toBe("freehold");
    expect(result.marketType).toBe("primary");
    expect(result.sellerType).toBe("agency");
    expect(result.hasElevator).toBe(true);
    expect(result.amenities).toEqual(["balkon"]); // invalid amenity removed
    expect(result.minPrice).toBe(500000);
    expect(result.maxPrice).toBe(1000000);
    expect(result.minArea).toBe(50);
    expect(result.maxArea).toBe(120);
    expect(result.minRooms).toBe(2);
    expect(result.maxRooms).toBe(4);
  });
});

describe("aiFiltersToWhere", () => {
  it("includes floor in the AND array when set", () => {
    const detected = {
      city: null,
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: false,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: null,
      maxRooms: null,
      minFloor: 2,
      maxFloor: 5,
    };
    const where = aiFiltersToWhere(detected);
    expect(where).toEqual({
      AND: [{ floor: { gte: 2, lte: 5 } }],
    });
  });

  it("omits floor when both min and max are null", () => {
    const detected = {
      city: null,
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: false,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: null,
      maxRooms: null,
      minFloor: null,
      maxFloor: null,
    };
    const where = aiFiltersToWhere(detected);
    expect(where).toEqual({});
  });

  it("includes only gte when maxFloor is null", () => {
    const detected = {
      city: null,
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: false,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: null,
      maxRooms: null,
      minFloor: 3,
      maxFloor: null,
    };
    const where = aiFiltersToWhere(detected);
    expect(where).toEqual({
      AND: [{ floor: { gte: 3 } }],
    });
  });

  it("includes only lte when minFloor is null (ground floor edge case)", () => {
    const detected = {
      city: null,
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: false,
      amenities: [],
      minPrice: null,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: null,
      maxRooms: null,
      minFloor: null,
      maxFloor: 0,
    };
    const where = aiFiltersToWhere(detected);
    expect(where).toEqual({
      AND: [{ floor: { lte: 0 } }],
    });
  });

  it("combines floor with other filter conditions", () => {
    const detected = {
      city: "Kraków",
      district: null,
      buildingType: null,
      ownershipForm: null,
      marketType: null,
      sellerType: null,
      hasElevator: true,
      amenities: ["balkon"],
      minPrice: 500000,
      maxPrice: null,
      minArea: null,
      maxArea: null,
      minRooms: 2,
      maxRooms: null,
      minFloor: 1,
      maxFloor: 3,
    };
    const where = aiFiltersToWhere(detected);
    expect(where).toEqual({
      AND: [
        { city: { equals: "Kraków" } },
        { hasElevator: true },
        { amenities: { array_contains: "balkon" } },
        { price: { gte: 500000 } },
        { rooms: { gte: 2 } },
        { floor: { gte: 1, lte: 3 } },
      ],
    });
  });
});
