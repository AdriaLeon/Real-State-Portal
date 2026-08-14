// AI counterpart to lib/api/searchQueryParser.ts.

import { ApiError, type GoogleGenAI } from "@google/genai";
import type { MarketType, Prisma, SellerType } from "../../generated/prisma/client.js";
import { MarketType as MarketTypeEnum, SellerType as SellerTypeEnum } from "../../generated/prisma/client.js";
import { CANONICAL_AMENITIES } from "../api/searchQueryParser.js";
import type { ListingFacets } from "../api/listingFacets.js";
import type { MarketStats } from "../api/marketStats.js";

const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

const SELLER_TYPES = Object.values(SellerTypeEnum);
const MARKET_TYPES = Object.values(MarketTypeEnum);

export interface AIDetectedFilters {
  city: string | null;
  district: string | null;
  buildingType: string | null;
  ownershipForm: string | null;
  marketType: MarketType | null;
  sellerType: SellerType | null;
  hasElevator: boolean;
  amenities: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  minRooms: number | null;
  maxRooms: number | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SYSTEM_PROMPT = `You extract structured search filters from a free-text query on a real-estate
listings website. You are given closed vocabularies for location, building type, ownership form,
and amenities — you must pick values ONLY from those vocabularies, exactly as spelled, or use null
when the query doesn't mention that filter. NEVER invent a city, district, building type, ownership
form, or amenity that isn't in the provided list, even if the query mentions something that sounds
plausible.

For minPrice/maxPrice/minArea/maxArea/minRooms/maxRooms: if the query gives an explicit number, use
it directly (assume PLN for prices unless stated otherwise). "Exactly N rooms" / "N-room flat" ->
set both minRooms and maxRooms to N. "At least N rooms" / "N+ rooms" -> minRooms only. "At most N
rooms" / "up to N rooms" -> maxRooms only. Same min/max logic for price and area.

If the query instead uses a vague relative term with NO explicit number, translate it using the
dataset's percentile stats given below, and ONLY then: "cheap"/"budget"/"tani" -> maxPrice ~= the
given 25th-percentile price; "expensive"/"luxury"/"drogi" -> minPrice ~= the given 75th-percentile
price; "small"/"mały" -> maxArea ~= the given 25th-percentile area; "big"/"spacious"/"duży" ->
minArea ~= the given 75th-percentile area. An explicit number in the query always takes priority
over this relative-term inference.`;

export function buildFilterExtractionPrompt(
  text: string,
  facets: ListingFacets,
  stats: MarketStats,
): { input: string; systemInstruction: string } {
  const lines = [
    SYSTEM_PROMPT,
    "",
    `Valid cities: ${facets.cities.join(", ") || "(none)"}`,
    `Valid districts: ${facets.districts.join(", ") || "(none)"}`,
    `Valid building types: ${facets.buildingTypes.join(", ") || "(none)"}`,
    `Valid ownership forms: ${facets.ownershipForms.join(", ") || "(none)"}`,
    `Valid amenities: ${CANONICAL_AMENITIES.join(", ")}`,
    `Valid seller types: ${SELLER_TYPES.join(", ")}`,
    `Valid market types: ${MARKET_TYPES.join(", ")}`,
    `Price percentiles (PLN): 25th ~= ${stats.price.p25}, 75th ~= ${stats.price.p75}`,
    `Area percentiles (m²): 25th ~= ${stats.area.p25}, 75th ~= ${stats.area.p75}`,
  ];
  return { input: text, systemInstruction: lines.join("\n") };
}

export function buildFilterSchema(facets: ListingFacets): Record<string, unknown> {
  const numberOrNull = { type: ["number", "null"] };
  return {
    type: "object",
    properties: {
      city: { type: ["string", "null"], enum: [...facets.cities, null] },
      district: { type: ["string", "null"], enum: [...facets.districts, null] },
      buildingType: { type: ["string", "null"], enum: [...facets.buildingTypes, null] },
      ownershipForm: { type: ["string", "null"], enum: [...facets.ownershipForms, null] },
      marketType: { type: ["string", "null"], enum: [...MARKET_TYPES, null] },
      sellerType: { type: ["string", "null"], enum: [...SELLER_TYPES, null] },
      hasElevator: { type: "boolean" },
      amenities: { type: "array", items: { type: "string", enum: CANONICAL_AMENITIES } },
      minPrice: numberOrNull,
      maxPrice: numberOrNull,
      minArea: numberOrNull,
      maxArea: numberOrNull,
      minRooms: numberOrNull,
      maxRooms: numberOrNull,
    },
    required: [
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
    ],
    additionalProperties: false,
  };
}

// A valid, non-negative number, or null for anything else (missing, wrong
// type, negative, NaN/Infinity).
function sanitizeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

// A min/max pair only makes sense together if min <= max; if a (still
// belt-and-suspenders) malformed response has them backwards, drop both
// rather than guess which one the model meant.
function sanitizeRange(min: unknown, max: unknown): [number | null, number | null] {
  const sanitizedMin = sanitizeNumber(min);
  const sanitizedMax = sanitizeNumber(max);
  if (sanitizedMin !== null && sanitizedMax !== null && sanitizedMin > sanitizedMax) return [null, null];
  return [sanitizedMin, sanitizedMax];
}

// Pure/testable: defensively re-validates the model's parsed JSON output
// against the live vocab before it's trusted to build a where-clause. The
// schema passed to Gemini already constrains this, but a model can still
// return malformed/unexpected JSON, so nothing here is assumed — anything
// that doesn't check out is clamped to null/empty rather than thrown.
export function sanitizeDetectedFilters(raw: unknown, facets: ListingFacets): AIDetectedFilters {
  const obj = raw !== null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const pickFromVocab = (value: unknown, vocab: string[]): string | null =>
    typeof value === "string" && vocab.includes(value) ? value : null;

  const city = pickFromVocab(obj.city, facets.cities);
  const district = pickFromVocab(obj.district, facets.districts);
  const buildingType = pickFromVocab(obj.buildingType, facets.buildingTypes);
  const ownershipForm = pickFromVocab(obj.ownershipForm, facets.ownershipForms);

  const amenities = Array.isArray(obj.amenities)
    ? [...new Set(obj.amenities.filter((a): a is string => typeof a === "string" && CANONICAL_AMENITIES.includes(a)))]
    : [];

  const hasElevator = obj.hasElevator === true;

  const sellerType =
    typeof obj.sellerType === "string" && (SELLER_TYPES as string[]).includes(obj.sellerType)
      ? (obj.sellerType as SellerType)
      : null;

  const marketType =
    typeof obj.marketType === "string" && (MARKET_TYPES as string[]).includes(obj.marketType)
      ? (obj.marketType as MarketType)
      : null;

  const [minPrice, maxPrice] = sanitizeRange(obj.minPrice, obj.maxPrice);
  const [minArea, maxArea] = sanitizeRange(obj.minArea, obj.maxArea);
  const [minRooms, maxRooms] = sanitizeRange(obj.minRooms, obj.maxRooms);

  return {
    city,
    district,
    buildingType,
    ownershipForm,
    marketType,
    sellerType,
    hasElevator,
    amenities,
    minPrice,
    maxPrice,
    minArea,
    maxArea,
    minRooms,
    maxRooms,
  };
}

function pushRange(and: Prisma.ListingWhereInput[], field: "price" | "area" | "rooms", min: number | null, max: number | null) {
  if (min === null && max === null) return;
  const range: { gte?: number; lte?: number } = {};
  if (min !== null) range.gte = min;
  if (max !== null) range.lte = max;
  and.push({ [field]: range } as Prisma.ListingWhereInput);
}

// Translates AIDetectedFilters into the Prisma where-clause that applies
// it — the AI-mode counterpart of detectedFiltersToWhere
// (lib/api/searchQueryParser.ts), extended with the extra fields the AI
// parser can fill in (building type, ownership form, and numeric
// price/area/room ranges instead of just relative bands).
export function aiFiltersToWhere(detected: AIDetectedFilters): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = [];
  if (detected.city !== null) and.push({ city: { equals: detected.city } });
  if (detected.district !== null) and.push({ district: { equals: detected.district } });
  if (detected.buildingType !== null) and.push({ buildingType: { equals: detected.buildingType } });
  if (detected.ownershipForm !== null) and.push({ ownershipForm: { equals: detected.ownershipForm } });
  if (detected.marketType !== null) and.push({ marketType: detected.marketType });
  if (detected.sellerType !== null) and.push({ sellerType: detected.sellerType });
  if (detected.hasElevator) and.push({ hasElevator: true });
  for (const term of detected.amenities) and.push({ amenities: { array_contains: term } });
  pushRange(and, "price", detected.minPrice, detected.maxPrice);
  pushRange(and, "area", detected.minArea, detected.maxArea);
  pushRange(and, "rooms", detected.minRooms, detected.maxRooms);

  return and.length > 0 ? { AND: and } : {};
}

// Calls Gemini to extract AIDetectedFilters from free text.
export async function parseSearchQueryAI(
  text: string,
  facets: ListingFacets,
  stats: MarketStats,
  client: GoogleGenAI,
): Promise<AIDetectedFilters> {
  const { input, systemInstruction } = buildFilterExtractionPrompt(text, facets, stats);
  const schema = buildFilterSchema(facets);
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const interaction = await client.interactions.create({
        model,
        input,
        system_instruction: systemInstruction,
        response_format: { type: "text", mime_type: "application/json", schema },
        // "minimal" thinking: a closed-vocabulary + basic arithmetic
        generation_config: { max_output_tokens: 500, thinking_level: "minimal" },
      });

      const outputText = interaction.output_text?.trim();
      if (!outputText) throw new Error("Empty response from model");

      const raw = JSON.parse(outputText);
      return sanitizeDetectedFilters(raw, facets);
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ApiError && (err.status === 429 || err.status >= 500);
      if (!retryable || attempt === MAX_RETRIES) break;
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError;
}
