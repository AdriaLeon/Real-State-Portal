import { describe, expect, it } from "vitest";
import type { Listing } from "../../generated/prisma/client.js";
import { toListingDetailDto, toListingSummaryDto } from "../../lib/api/listingDto.js";

function fixture(overrides: Partial<Listing> = {}): Listing {
  return {
    sourceId: "73695494",
    source: "sprzedajemy",
    url: "https://sprzedajemy.pl/oferta/nr73695494",
    title: "Kraków – 2 pokojowy apartament z widokiem",
    description: "Przestronne mieszkanie w centrum.",
    city: "Kraków",
    district: "Płaszów",
    price: 774630,
    pricePerM2: 15100,
    isNegotiable: false,
    area: 51.3,
    rooms: 2,
    floor: 1,
    totalFloors: 4,
    yearBuilt: 2019,
    marketType: "secondary",
    buildingType: "apartamentowiec",
    ownershipForm: "pełna własność",
    heating: "miejskie",
    sellerType: "private",
    hasElevator: true,
    amenities: ["winda", "balkon"],
    images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
    imageCount: 2,
    AI_resume: "A bright 2-room flat in Płaszów, Kraków.",
    contentHash: "a".repeat(64),
    fetchedAt: new Date("2026-01-01T00:00:00.000Z"),
    normalizedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  } as Listing;
}

describe("toListingSummaryDto", () => {
  it("picks only the key card fields, using the first image", () => {
    expect(toListingSummaryDto(fixture())).toEqual({
      id: "73695494",
      image: "https://example.com/1.jpg",
      price: 774630,
      location: { city: "Kraków", district: "Płaszów" },
      size: { area: 51.3, rooms: 2 },
    });
  });

  it("returns a null image when there are no images", () => {
    expect(toListingSummaryDto(fixture({ images: [] })).image).toBeNull();
  });

  it("falls back to an empty image when the JSON column holds non-array garbage", () => {
    expect(toListingSummaryDto(fixture({ images: "not-an-array" as unknown as string[] })).image).toBeNull();
  });
});

describe("toListingDetailDto", () => {
  it("maps the full row, renaming AI_resume and sourceId, dropping contentHash", () => {
    const dto = toListingDetailDto(fixture());
    expect(dto.id).toBe("73695494");
    expect(dto.aiSummary).toBe("A bright 2-room flat in Płaszów, Kraków.");
    expect(dto).not.toHaveProperty("contentHash");
    expect(dto).not.toHaveProperty("sourceId");
    expect(dto).not.toHaveProperty("AI_resume");
    expect(dto.amenities).toEqual(["winda", "balkon"]);
    expect(dto.images).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
    expect(dto.createdAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("filters non-string entries out of malformed JSON array columns", () => {
    const dto = toListingDetailDto(fixture({ amenities: [1, "balkon", null] as unknown as string[] }));
    expect(dto.amenities).toEqual(["balkon"]);
  });

  it("passes through a null AI summary", () => {
    expect(toListingDetailDto(fixture({ AI_resume: null })).aiSummary).toBeNull();
  });
});
