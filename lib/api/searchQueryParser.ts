// Free-text query -> Prisma where clause + a summary of what was detected,
// for the /search endpoint. Pure and DB-free: vocab/stats are passed in as
// plain data so this is fully unit-testable without a database.

import { MarketType, type Prisma, SellerType } from "../../generated/prisma/client.js";
import type { MarketStats } from "./marketStats.js";
import type { SearchVocabulary } from "./searchVocabulary.js";

export interface DetectedFilters {
  city: string | null;
  district: string | null;
  amenities: string[]; // canonical Polish terms; excludes "winda" (see hasElevator)
  hasElevator: boolean;
  sellerType: SellerType | null;
  marketType: MarketType | null;
  priceBand: "cheap" | "expensive" | null;
  areaBand: "small" | "big" | null;
}

export interface ParsedSearchQuery {
  where: Prisma.ListingWhereInput;
  detected: DetectedFilters;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Index of the first match of `phrase` in `text` as a whole word/phrase
// (Unicode letter/digit boundary on both sides), or -1 if absent. Both
// arguments are expected already lowercased by the caller.
function matchIndex(text: string, phrase: string): number {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}])`, "u");
  const m = re.exec(text);
  return m ? m.index : -1;
}

// Scans every phrase across every candidate and returns the one whose
// match starts earliest in the text (ties broken by the longer phrase
// winning).
function earliestMatch<T>(text: string, candidates: { value: T; phrases: string[] }[]): T | null {
  let best: { value: T; index: number; length: number } | null = null;
  for (const candidate of candidates) {
    for (const phrase of candidate.phrases) {
      const index = matchIndex(text, phrase);
      if (index === -1) continue;
      if (best === null || index < best.index || (index === best.index && phrase.length > best.length)) {
        best = { value: candidate.value, index, length: phrase.length };
      }
    }
  }
  return best ? best.value : null;
}

// Same idea, specialized for vocabulary lookups (city/district): candidates
// are literal DB values, matched case-insensitively but returned in their
// original casing (so the where-clause value matches what's actually
// stored).
function earliestVocabMatch(text: string, vocab: string[]): string | null {
  let best: { value: string; index: number; length: number } | null = null;
  for (const value of vocab) {
    const index = matchIndex(text, value.toLowerCase());
    if (index === -1) continue;
    if (best === null || index < best.index || (index === best.index && value.length > best.length)) {
      best = { value, index, length: value.length };
    }
  }
  return best ? best.value : null;
}

// English/Polish synonym since "amenities" in the DB are usually stored in Polish.
const AMENITY_SYNONYMS: Record<string, string> = {
  balcony: "balkon",
  balkon: "balkon",
  parking: "miejsce parkingowe",
  "parking spot": "miejsce parkingowe",
  "miejsce parkingowe": "miejsce parkingowe",
  garage: "garaż",
  garaż: "garaż",
  garaz: "garaż",
  terrace: "taras",
  taras: "taras",
  garden: "ogródek",
  ogródek: "ogródek",
  ogrodek: "ogródek",
  furnished: "umeblowane",
  umeblowane: "umeblowane",
  basement: "piwnica",
  cellar: "piwnica",
  piwnica: "piwnica",
  attic: "strych",
  strych: "strych",
};

const ELEVATOR_PHRASES = ["elevator", "winda"];

const SELLER_TYPE_CANDIDATES: { value: SellerType; phrases: string[] }[] = [
  { value: SellerType.private, phrases: ["private seller", "private", "prywatny", "osoba prywatna"] },
  { value: SellerType.agency, phrases: ["agency", "agent", "agencja", "firma"] },
];

// Kept intentionally small to avoid false positive.
const MARKET_TYPE_CANDIDATES: { value: MarketType; phrases: string[] }[] = [
  { value: MarketType.primary, phrases: ["primary market", "rynek pierwotny"] },
  { value: MarketType.secondary, phrases: ["secondary market", "rynek wtórny"] },
];

const PRICE_BAND_CANDIDATES: { value: "cheap" | "expensive"; phrases: string[] }[] = [
  { value: "cheap", phrases: ["cheap", "tani", "tania", "tanie"] },
  { value: "expensive", phrases: ["expensive", "drogi", "droga", "drogie"] },
];

const AREA_BAND_CANDIDATES: { value: "small" | "big"; phrases: string[] }[] = [
  { value: "small", phrases: ["small", "mały", "mała", "małe"] },
  { value: "big", phrases: ["big", "large", "duży", "duża", "duże"] },
];

export function parseSearchQuery(text: string, vocab: SearchVocabulary, stats: MarketStats): ParsedSearchQuery {
  const lower = text.toLowerCase();

  // City and district are detected independently of each other.
  const city = earliestVocabMatch(lower, vocab.cities);
  const district = earliestVocabMatch(lower, vocab.districts);

  const amenitySet = new Set<string>();
  for (const [synonym, canonical] of Object.entries(AMENITY_SYNONYMS)) {
    if (matchIndex(lower, synonym) !== -1) amenitySet.add(canonical);
  }
  const amenities = [...amenitySet];

  const hasElevator = ELEVATOR_PHRASES.some((phrase) => matchIndex(lower, phrase) !== -1);

  const sellerType = earliestMatch(lower, SELLER_TYPE_CANDIDATES);
  const marketType = earliestMatch(lower, MARKET_TYPE_CANDIDATES);
  const priceBand = earliestMatch(lower, PRICE_BAND_CANDIDATES);
  const areaBand = earliestMatch(lower, AREA_BAND_CANDIDATES);

  const and: Prisma.ListingWhereInput[] = [];
  if (city !== null) and.push({ city: { equals: city } });
  if (district !== null) and.push({ district: { equals: district } });
  if (hasElevator) and.push({ hasElevator: true });
  for (const term of amenities) and.push({ amenities: { array_contains: term } });
  if (sellerType !== null) and.push({ sellerType });
  if (marketType !== null) and.push({ marketType });
  if (priceBand === "cheap") and.push({ price: { lte: stats.price.p25 } });
  if (priceBand === "expensive") and.push({ price: { gte: stats.price.p75 } });
  if (areaBand === "small") and.push({ area: { lte: stats.area.p25 } });
  if (areaBand === "big") and.push({ area: { gte: stats.area.p75 } });

  return {
    where: and.length > 0 ? { AND: and } : {},
    detected: { city, district, amenities, hasElevator, sellerType, marketType, priceBand, areaBand },
  };
}