import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "../../lib/api/searchQueryParser.js";
import type { MarketStats } from "../../lib/api/marketStats.js";
import type { SearchVocabulary } from "../../lib/api/searchVocabulary.js";

const vocab: SearchVocabulary = {
  cities: ["Kraków", "Warszawa", "Wrocław"],
  districts: ["Stare Miasto", "Śródmieście", "Żoliborz", "Krzyki"],
};

const stats: MarketStats = {
  price: { p25: 400000, p75: 800000 },
  area: { p25: 30, p75: 60 },
};

describe("parseSearchQuery", () => {
  it("returns an empty where and all-empty detected fields for a query with no matches", () => {
    const { where, detected } = parseSearchQuery("hello world", vocab, stats);
    expect(where).toEqual({});
    expect(detected).toEqual({
      city: null,
      district: null,
      amenities: [],
      hasElevator: false,
      sellerType: null,
      marketType: null,
      priceBand: null,
      areaBand: null,
      minRooms: null,
      maxRooms: null,
      minFloor: null,
      maxFloor: null,
    });
  });

  it("detects a city", () => {
    const { detected } = parseSearchQuery("flat in Kraków", vocab, stats);
    expect(detected.city).toBe("Kraków");
  });

  it("is case-insensitive for city matching", () => {
    expect(parseSearchQuery("flat in KRAKÓW", vocab, stats).detected.city).toBe("Kraków");
  });

  it("is diacritic-insensitive for city matching", () => {
    expect(parseSearchQuery("flat in krakow", vocab, stats).detected.city).toBe("Kraków");
    expect(parseSearchQuery("flat in Wroclaw", vocab, stats).detected.city).toBe("Wrocław");
  });

  it("detects a multi-word district", () => {
    const { detected } = parseSearchQuery("apartment in Stare Miasto", vocab, stats);
    expect(detected.district).toBe("Stare Miasto");
  });

  it("detects a district starting with an accented letter", () => {
    // Regression: a plain \b<phrase>\b regex fails here because JS's \b only
    // treats ASCII [A-Za-z0-9_] as "word" characters, so a space followed by
    // "Ś"/"Ż" looks like non-word-to-non-word (no boundary at all).
    expect(parseSearchQuery("flat in Śródmieście", vocab, stats).detected.district).toBe("Śródmieście");
    expect(parseSearchQuery("flat in Żoliborz", vocab, stats).detected.district).toBe("Żoliborz");
  });

  it("does not infer a city from a matched district or vice versa", () => {
    const { detected } = parseSearchQuery("flat in Krzyki", vocab, stats);
    expect(detected.district).toBe("Krzyki");
    expect(detected.city).toBeNull();
  });

  it("detects amenities in English and Polish, deduping synonyms", () => {
    const { detected } = parseSearchQuery("balcony and garage, also garaż", vocab, stats);
    expect(detected.amenities.sort()).toEqual(["balkon", "garaż"]);
  });

  it("detects elevator as hasElevator, not as an amenity", () => {
    const enDetected = parseSearchQuery("flat with elevator", vocab, stats).detected;
    expect(enDetected.hasElevator).toBe(true);
    expect(enDetected.amenities).not.toContain("winda");

    const plDetected = parseSearchQuery("mieszkanie z winda", vocab, stats).detected;
    expect(plDetected.hasElevator).toBe(true);
  });

  it("does not match 'small' inside an unrelated longer word", () => {
    expect(parseSearchQuery("smaller than expected", vocab, stats).detected.areaBand).toBeNull();
  });

  describe("seller type", () => {
    it("detects private seller in English and Polish", () => {
      expect(parseSearchQuery("private seller", vocab, stats).detected.sellerType).toBe("private");
      expect(parseSearchQuery("prywatny", vocab, stats).detected.sellerType).toBe("private");
      expect(parseSearchQuery("osoba prywatna", vocab, stats).detected.sellerType).toBe("private");
    });

    it("detects agency in English and Polish", () => {
      expect(parseSearchQuery("agency listing", vocab, stats).detected.sellerType).toBe("agency");
      expect(parseSearchQuery("agencja", vocab, stats).detected.sellerType).toBe("agency");
    });
  });

  describe("market type", () => {
    it("detects primary and secondary market phrases", () => {
      expect(parseSearchQuery("primary market", vocab, stats).detected.marketType).toBe("primary");
      expect(parseSearchQuery("rynek wtórny", vocab, stats).detected.marketType).toBe("secondary");
    });

    it("does not treat bare 'new'/'nowe' as a primary-market trigger", () => {
      expect(parseSearchQuery("new paint job", vocab, stats).detected.marketType).toBeNull();
      expect(parseSearchQuery("nowe okna", vocab, stats).detected.marketType).toBeNull();
    });
  });

  describe("price/area bands", () => {
    it("maps cheap/expensive to the price percentile thresholds", () => {
      expect(parseSearchQuery("cheap flat", vocab, stats).where).toEqual({
        AND: [{ price: { lte: 400000 } }],
      });
      expect(parseSearchQuery("expensive flat", vocab, stats).where).toEqual({
        AND: [{ price: { gte: 800000 } }],
      });
    });

    it("maps small/big to the area percentile thresholds", () => {
      expect(parseSearchQuery("small flat", vocab, stats).where).toEqual({
        AND: [{ area: { lte: 30 } }],
      });
      expect(parseSearchQuery("big flat", vocab, stats).where).toEqual({
        AND: [{ area: { gte: 60 } }],
      });
    });

    it("recognizes Polish band keywords", () => {
      expect(parseSearchQuery("tanie mieszkanie", vocab, stats).detected.priceBand).toBe("cheap");
      expect(parseSearchQuery("drogie mieszkanie", vocab, stats).detected.priceBand).toBe("expensive");
      expect(parseSearchQuery("małe mieszkanie", vocab, stats).detected.areaBand).toBe("small");
      expect(parseSearchQuery("duże mieszkanie", vocab, stats).detected.areaBand).toBe("big");
    });
  });

  describe("earliest-mention-wins conflict resolution", () => {
    it("picks whichever of a conflicting pair appears first in the text", () => {
      expect(parseSearchQuery("cheap, not expensive", vocab, stats).detected.priceBand).toBe("cheap");
      expect(parseSearchQuery("expensive, not cheap", vocab, stats).detected.priceBand).toBe("expensive");
    });
  });

  it("combines multiple detected conditions into one AND where clause", () => {
    const { where, detected } = parseSearchQuery("cheap flat in Kraków with elevator, private seller", vocab, stats);
    expect(detected.city).toBe("Kraków");
    expect(detected.hasElevator).toBe(true);
    expect(detected.sellerType).toBe("private");
    expect(detected.priceBand).toBe("cheap");
    expect(where).toEqual({
      AND: [
        { city: { equals: "Kraków" } },
        { hasElevator: true },
        { sellerType: "private" },
        { price: { lte: 400000 } },
      ],
    });
  });

  it("combines multiple matched amenities as separate AND entries, not clobbering flat keys", () => {
    const { where } = parseSearchQuery("balcony and garden", vocab, stats);
    expect(where).toEqual({
      AND: [{ amenities: { array_contains: "balkon" } }, { amenities: { array_contains: "ogródek" } }],
    });
  });

  describe("rooms", () => {
    it("detects an exact room count in English and Polish phrasing", () => {
      expect(parseSearchQuery("3 rooms in Kraków", vocab, stats).detected).toMatchObject({
        minRooms: 3,
        maxRooms: 3,
      });
      expect(parseSearchQuery("mieszkanie 3-pokojowe", vocab, stats).detected).toMatchObject({
        minRooms: 3,
        maxRooms: 3,
      });
      expect(parseSearchQuery("2pokojowe mieszkanie", vocab, stats).detected).toMatchObject({
        minRooms: 2,
        maxRooms: 2,
      });
    });

    it("detects an at-least room count", () => {
      expect(parseSearchQuery("3+ rooms", vocab, stats).detected).toMatchObject({ minRooms: 3, maxRooms: null });
      expect(parseSearchQuery("at least 2 pokoje", vocab, stats).detected).toMatchObject({
        minRooms: 2,
        maxRooms: null,
      });
    });

    it("detects an at-most room count", () => {
      expect(parseSearchQuery("up to 4 rooms", vocab, stats).detected).toMatchObject({
        minRooms: null,
        maxRooms: 4,
      });
    });

    it("maps a detected room count to a Prisma range clause", () => {
      expect(parseSearchQuery("3 rooms", vocab, stats).where).toEqual({
        AND: [{ rooms: { gte: 3, lte: 3 } }],
      });
      expect(parseSearchQuery("3+ rooms", vocab, stats).where).toEqual({
        AND: [{ rooms: { gte: 3 } }],
      });
    });
  });

  describe("floor", () => {
    it("detects ground floor in English and Polish", () => {
      expect(parseSearchQuery("ground floor flat", vocab, stats).detected).toMatchObject({
        minFloor: 0,
        maxFloor: 0,
      });
      expect(parseSearchQuery("mieszkanie na parterze", vocab, stats).detected).toMatchObject({
        minFloor: 0,
        maxFloor: 0,
      });
      expect(parseSearchQuery("parter", vocab, stats).detected).toMatchObject({
        minFloor: 0,
        maxFloor: 0,
      });
    });

    it("detects an exact floor count with and without ordinal suffixes", () => {
      expect(parseSearchQuery("3rd floor flat", vocab, stats).detected).toMatchObject({
        minFloor: 3,
        maxFloor: 3,
      });
      expect(parseSearchQuery("2nd floor", vocab, stats).detected).toMatchObject({
        minFloor: 2,
        maxFloor: 2,
      });
      expect(parseSearchQuery("floor 3", vocab, stats).detected).toMatchObject({
        minFloor: 3,
        maxFloor: 3,
      });
      expect(parseSearchQuery("3 floor", vocab, stats).detected).toMatchObject({
        minFloor: 3,
        maxFloor: 3,
      });
    });

    it("detects Polish floor phrasing with various inflections", () => {
      // piętro, piętrze, piętrach all normalize to "pietro" before regex matching
      expect(parseSearchQuery("mieszkanie na piętrze 4", vocab, stats).detected).toMatchObject({
        minFloor: 4,
        maxFloor: 4,
      });
      expect(parseSearchQuery("piętro 2", vocab, stats).detected).toMatchObject({
        minFloor: 2,
        maxFloor: 2,
      });
    });

    it("detects an at-least floor count", () => {
      expect(parseSearchQuery("at least floor 2", vocab, stats).detected).toMatchObject({
        minFloor: 2,
        maxFloor: null,
      });
      expect(parseSearchQuery("floor 3 or higher", vocab, stats).detected).toMatchObject({
        minFloor: 3,
        maxFloor: null,
      });
      expect(parseSearchQuery("co najmniej piętro 5", vocab, stats).detected).toMatchObject({
        minFloor: 5,
        maxFloor: null,
      });
    });

    it("detects an at-most floor count", () => {
      expect(parseSearchQuery("up to floor 5", vocab, stats).detected).toMatchObject({
        minFloor: null,
        maxFloor: 5,
      });
      expect(parseSearchQuery("maksymalnie piętro 4", vocab, stats).detected).toMatchObject({
        minFloor: null,
        maxFloor: 4,
      });
    });

    it("maps a detected floor count to a Prisma range clause", () => {
      expect(parseSearchQuery("3rd floor", vocab, stats).where).toEqual({
        AND: [{ floor: { gte: 3, lte: 3 } }],
      });
      expect(parseSearchQuery("at least floor 2", vocab, stats).where).toEqual({
        AND: [{ floor: { gte: 2 } }],
      });
      expect(parseSearchQuery("ground floor", vocab, stats).where).toEqual({
        AND: [{ floor: { gte: 0, lte: 0 } }],
      });
    });

    it("correctly handles rooms and floor in the same query without cross-contamination", () => {
      const { detected } = parseSearchQuery("3 rooms, 2nd floor", vocab, stats);
      expect(detected.minRooms).toBe(3);
      expect(detected.maxRooms).toBe(3);
      expect(detected.minFloor).toBe(2);
      expect(detected.maxFloor).toBe(2);
    });
  });
});
