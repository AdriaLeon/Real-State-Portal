import { describe, expect, it } from "vitest";
import {
  parseArea,
  parseDistrict,
  parseFloor,
  parsePrice,
  parseTotalFloors,
  parseYearBuilt,
  mapMarketType,
  mapSellerType,
  isPlausibleSalePrice,
} from "../../lib/normalize/fields.js";
import { extractOfferJSON } from "../../lib/normalize/structuredData.js";

describe("parseArea", () => {
  it("parses a plain m² value", () => {
    expect(parseArea("51.3 m²")).toBe(51.3);
  });

  it("parses a whole-number m² value", () => {
    expect(parseArea("65 m²")).toBe(65);
  });
});

describe("parsePrice", () => {
  it("strips the zł/m² suffix", () => {
    expect(parsePrice("15100 zł/m²")).toBe(15100);
  });

  it("strips spaces used as thousands separators", () => {
    expect(parsePrice("774 630 zł")).toBe(774630);
  });
});

describe("parseFloor", () => {
  it("maps 'parter' to ground floor (0)", () => {
    expect(parseFloor("parter")).toBe(0);
  });

  it("parses a numeric floor", () => {
    expect(parseFloor("1")).toBe(1);
  });

  it("is case-insensitive for 'parter'", () => {
    expect(parseFloor("Parter")).toBe(0);
  });
});

describe("parseTotalFloors", () => {
  it("parses the leading number out of a descriptive string", () => {
    expect(parseTotalFloors("3 piętra i więcej")).toBe(3);
  });

  it("returns null when the attribute is absent", () => {
    expect(parseTotalFloors(undefined)).toBeNull();
  });
});

describe("parseYearBuilt", () => {
  it("parses a 4-digit year", () => {
    expect(parseYearBuilt("2019")).toBe(2019);
  });

  it("returns null when absent", () => {
    expect(parseYearBuilt(undefined)).toBeNull();
  });
});

describe("parseDistrict", () => {
  it("strips the city-prefixed breadcrumb text to recover the district", () => {
    expect(parseDistrict("Mieszkania na sprzedaż Kraków Płaszów", "Kraków")).toBe("Płaszów");
  });

  it("returns null when the breadcrumb is city-wide (no district)", () => {
    expect(parseDistrict("Mieszkania na sprzedaż Kraków", "Kraków")).toBeNull();
  });

  it("returns null when the breadcrumb is missing entirely", () => {
    expect(parseDistrict(null, "Kraków")).toBeNull();
  });
});

describe("mapMarketType", () => {
  it("maps wtórny -> secondary", () => {
    expect(mapMarketType("wtórny")).toBe("secondary");
  });

  it("maps pierwotny -> primary", () => {
    expect(mapMarketType("pierwotny")).toBe("primary");
  });
});

describe("mapSellerType", () => {
  it("maps osoby prywatnej -> private", () => {
    expect(mapSellerType("osoby prywatnej")).toBe("private");
  });

  it("maps firmy -> agency", () => {
    expect(mapSellerType("firmy")).toBe("agency");
  });
});

describe("isPlausibleSalePrice", () => {
  it("rejects a rent-like price (the confirmed rental-ad outlier: 51 PLN/m²)", () => {
    expect(isPlausibleSalePrice(51)).toBe(false);
  });

  it("accepts a realistic sale price", () => {
    expect(isPlausibleSalePrice(9091)).toBe(true);
  });
});

describe("extractOfferJSON", () => {
  it("correctly balances nested braces instead of stopping at the first inner '}'", () => {
    // Regression test: a naive non-greedy regex like /SPR\.OfferJSON\s*=\s*(\{.*?\});/
    // stops at the first "}" it finds, which is inside the nested
    // goOfferProperties object here — not the real end of the value.
    const html = `
      <script>
        SPR.OfferJSON = {"offerPrice":"774630.00","goOfferProperties":{"priceAsNumber":774630,"nested":{"a":1}},"accountType":"personal"};
      </script>
    `;
    const result = extractOfferJSON(html);
    expect(result).not.toBeNull();
    expect(result?.offerPrice).toBe("774630.00");
    expect(result?.accountType).toBe("personal");
    expect(result?.goOfferProperties?.priceAsNumber).toBe(774630);
  });

  it("returns null when the marker is absent", () => {
    expect(extractOfferJSON("<html></html>")).toBeNull();
  });
});
