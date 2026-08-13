import { describe, expect, it } from "vitest";
import { buildPrompt, computeContentHash } from "../../lib/ai/summarize.js";
import type { NormalizedListing } from "../../lib/normalize/normalizeListing.js";

function fixture(overrides: Partial<NormalizedListing> = {}): NormalizedListing {
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
    images: ["https://example.com/1.jpg"],
    imageCount: 1,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    normalizedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildPrompt", () => {
  it("includes the key facts a summary should be grounded in", () => {
    const prompt = buildPrompt(fixture());
    expect(prompt).toContain("Płaszów, Kraków");
    expect(prompt).toContain("774,630 PLN");
    expect(prompt).toContain("15,100 PLN/m²");
    expect(prompt).toContain("51.3 m², 2 room(s)");
    expect(prompt).toContain("elevator: yes");
    expect(prompt).toContain("Year built: 2019");
    expect(prompt).toContain("Amenities: winda, balkon");
  });

  it("renders ground floor and missing optional fields sensibly", () => {
    const prompt = buildPrompt(
      fixture({ floor: 0, totalFloors: null, yearBuilt: null, hasElevator: false, district: null, amenities: [] }),
    );
    expect(prompt).toContain("Floor: ground floor, elevator: no");
    expect(prompt).not.toContain("Year built:");
    expect(prompt).not.toContain("Amenities:");
    expect(prompt).toContain("Location: Kraków");
  });
});

describe("computeContentHash", () => {
  it("is stable for the same content", () => {
    expect(computeContentHash(fixture())).toBe(computeContentHash(fixture()));
  });

  it("changes when a fact that feeds the prompt changes", () => {
    const a = computeContentHash(fixture());
    const b = computeContentHash(fixture({ price: 800000 }));
    expect(a).not.toBe(b);
  });

  it("is unaffected by fields that don't feed the prompt (fetchedAt/normalizedAt/url)", () => {
    const a = computeContentHash(fixture());
    const b = computeContentHash(
      fixture({
        fetchedAt: "2026-02-02T00:00:00.000Z",
        normalizedAt: "2026-02-02T00:00:00.000Z",
        url: "https://sprzedajemy.pl/oferta/nr-different",
      }),
    );
    expect(a).toBe(b);
  });
});
