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
  minRooms: number | null;
  maxRooms: number | null;
  minFloor: number | null;
  maxFloor: number | null;
}

export interface ParsedSearchQuery {
  where: Prisma.ListingWhereInput;
  detected: DetectedFilters;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Lowercases and strips diacritics so accented and unaccented spellings
// match each other (e.g. "krakow" vs "Kraków"). NFD decomposes most
// accented Latin letters into base + combining mark, which the regex then
// strips; Polish "ł"/"Ł" don't decompose that way, so they're handled
// manually.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

// Index of the first match of `phrase` in `text` as a whole word/phrase
// (Unicode letter/digit boundary on both sides), or -1 if absent. Both
// arguments are normalized (case/diacritic-insensitive) internally.
function matchIndex(text: string, phrase: string): number {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normalize(phrase))}(?![\\p{L}\\p{N}])`, "u");
  const m = re.exec(normalize(text));
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
    const index = matchIndex(text, value);
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

// Deduped canonical amenity values (the right-hand side of AMENITY_SYNONYMS),
// e.g. for constraining the AI parser's structured-output schema to the same
// vocabulary this regex parser recognizes (see lib/ai/searchQueryAI.ts).
export const CANONICAL_AMENITIES: string[] = [...new Set(Object.values(AMENITY_SYNONYMS))];

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

// Matches English "room(s)" and any Polish inflection of "pokój" (pokoje,
// pokoi, pokojowe, pokojowy, pokojami, ...) — normalization turns ó -> o,
// so they all share the "poko" root.
const ROOM_WORD = "(?:rooms?|poko\\w*)";
const MIN_ROOMS_RE = new RegExp(`(?:at least|min(?:imum)?|co najmniej)\\s*(\\d+)\\s*-?\\s*${ROOM_WORD}`);
const ROOMS_PLUS_RE = new RegExp(`(\\d+)\\s*\\+\\s*${ROOM_WORD}`);
const MAX_ROOMS_RE = new RegExp(`(?:at most|up to|max(?:imum)?|maksymalnie)\\s*(\\d+)\\s*-?\\s*${ROOM_WORD}`);
const EXACT_ROOMS_RE = new RegExp(`(\\d+)\\s*-?\\s*${ROOM_WORD}`);

// Matches English "floor(s)" and any Polish inflection of "piętro" (piętrze, piętrach,
// piętrowe, ...) — normalization turns ę -> e, so they all share the "pietr" root.
const FLOOR_WORD = "(?:floors?|pietr\\w*)";
const GROUND_FLOOR_RE = /\b(?:ground floor|parter\w*)\b/;
// Qualifier patterns (at least, at most, etc.) - also matches "floor N or higher" natural phrasing
const MIN_FLOOR_RE = new RegExp(`(?:(?:at least|min(?:imum)?|co najmniej)\\s+(?:${FLOOR_WORD}\\s+)?|${FLOOR_WORD}\\s+(?=\\S.*or\\s+higher))(\\d+)`);
const FLOOR_PLUS_RE = new RegExp(`(\\d+)\\s*\\+\\s*${FLOOR_WORD}`);
const MAX_FLOOR_RE = new RegExp(`(?:at most|up to|max(?:imum)?|maksymalnie)\\s+(?:${FLOOR_WORD}\\s+)?(\\d+)`);
// Exact floor patterns: word-before-number or number-before-word, floor word required
const FLOOR_BEFORE_NUMBER_RE = new RegExp(`${FLOOR_WORD}\\s+(\\d+)`);
const NUMBER_BEFORE_FLOOR_RE = new RegExp(`(\\d+)\\s*(?:st|nd|rd|th)?\\s*${FLOOR_WORD}`);

// Extracts an explicit room count from already-normalized text, e.g.
// "3 rooms"/"3-pokojowe" (exact), "3+ rooms"/"at least 2 pokoje" (min
// only), "up to 4 rooms" (max only). Checked in this order so a qualified
// phrase like "at least 3 rooms" doesn't fall through to the exact case.
function extractRoomRange(text: string): { minRooms: number | null; maxRooms: number | null } {
  const min = MIN_ROOMS_RE.exec(text) ?? ROOMS_PLUS_RE.exec(text);
  if (min) return { minRooms: Number(min[1]), maxRooms: null };

  const max = MAX_ROOMS_RE.exec(text);
  if (max) return { minRooms: null, maxRooms: Number(max[1]) };

  const exact = EXACT_ROOMS_RE.exec(text);
  if (exact) {
    const n = Number(exact[1]);
    return { minRooms: n, maxRooms: n };
  }

  return { minRooms: null, maxRooms: null };
}

// Extracts an explicit floor from already-normalized text, e.g.
// "ground floor"/"parter" (exact 0), "3rd floor"/"3 floor"/"floor 3"/"piętro 3" (exact),
// "at least floor 2" (min only), "up to floor 4" (max only). Ground floor is checked
// first since it has no digit to capture.
function extractFloorRange(text: string): { minFloor: number | null; maxFloor: number | null } {
  // Ground floor special case — "ground floor" or any "parter*" inflection -> floor 0
  if (GROUND_FLOOR_RE.test(text)) return { minFloor: 0, maxFloor: 0 };

  const min = MIN_FLOOR_RE.exec(text) ?? FLOOR_PLUS_RE.exec(text);
  if (min) return { minFloor: Number(min[1]), maxFloor: null };

  const max = MAX_FLOOR_RE.exec(text);
  if (max) return { minFloor: null, maxFloor: Number(max[1]) };

  // Try both "floor 3" and "3 floor" patterns for exact floor
  const exactWordFirst = FLOOR_BEFORE_NUMBER_RE.exec(text);
  if (exactWordFirst) {
    const n = Number(exactWordFirst[1]);
    return { minFloor: n, maxFloor: n };
  }

  const exactNumberFirst = NUMBER_BEFORE_FLOOR_RE.exec(text);
  if (exactNumberFirst) {
    const n = Number(exactNumberFirst[1]);
    return { minFloor: n, maxFloor: n };
  }

  return { minFloor: null, maxFloor: null };
}

// Translates an already-detected filter set into the Prisma where-clause
// that applies it so AI parser has it into account when generating the structured output. This is a separate function
export function detectedFiltersToWhere(detected: DetectedFilters, stats: MarketStats): Prisma.ListingWhereInput {
  const { city, district, amenities, hasElevator, sellerType, marketType, priceBand, areaBand, minRooms, maxRooms, minFloor, maxFloor } =
    detected;

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
  if (minRooms !== null || maxRooms !== null) {
    const range: { gte?: number; lte?: number } = {};
    if (minRooms !== null) range.gte = minRooms;
    if (maxRooms !== null) range.lte = maxRooms;
    and.push({ rooms: range });
  }
  if (minFloor !== null || maxFloor !== null) {
    const range: { gte?: number; lte?: number } = {};
    if (minFloor !== null) range.gte = minFloor;
    if (maxFloor !== null) range.lte = maxFloor;
    and.push({ floor: range });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function parseSearchQuery(text: string, vocab: SearchVocabulary, stats: MarketStats): ParsedSearchQuery {
  const lower = normalize(text);

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
  const { minRooms, maxRooms } = extractRoomRange(lower);
  const { minFloor, maxFloor } = extractFloorRange(lower);

  const detected: DetectedFilters = {
    city,
    district,
    amenities,
    hasElevator,
    sellerType,
    marketType,
    priceBand,
    areaBand,
    minRooms,
    maxRooms,
    minFloor,
    maxFloor,
  };
  return { where: detectedFiltersToWhere(detected, stats), detected };
}