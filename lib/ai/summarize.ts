// AI-generated buyer-facing summaries ("AI_resume") for already-normalized
// listings. Field extraction itself (lib/normalize/*) stays fully deterministic.

import { ApiError, GoogleGenAI } from "@google/genai";
import { createHash } from "node:crypto";
import type { NormalizedListing } from "../normalize/normalizeListing.js";

const DEFAULT_MODEL = "gemini-3.6-flash";
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The subset of a NormalizedListing that actually feeds the prompt.
// Deliberately excludes url/fetchedAt/normalizedAt so the hash (and
// therefore the enrich.ts cache) stays stable across normalize.ts
// re-runs unless a fact that could change the summary actually changed.
function contentFingerprint(listing: NormalizedListing) {
  return {
    title: listing.title,
    description: listing.description,
    city: listing.city,
    district: listing.district,
    price: listing.price,
    pricePerM2: listing.pricePerM2,
    isNegotiable: listing.isNegotiable,
    area: listing.area,
    rooms: listing.rooms,
    floor: listing.floor,
    totalFloors: listing.totalFloors,
    yearBuilt: listing.yearBuilt,
    marketType: listing.marketType,
    buildingType: listing.buildingType,
    ownershipForm: listing.ownershipForm,
    heating: listing.heating,
    sellerType: listing.sellerType,
    hasElevator: listing.hasElevator,
    amenities: listing.amenities,
  };
}

export function computeContentHash(listing: NormalizedListing): string {
  const json = JSON.stringify(contentFingerprint(listing));
  return createHash("sha256").update(json).digest("hex");
}

export function buildPrompt(listing: NormalizedListing): string {
  const lines: string[] = [];

  lines.push(`Title: ${listing.title}`);
  if (listing.description) lines.push(`Description: ${listing.description.slice(0, 500)}`);
  lines.push(`Location: ${listing.district ? `${listing.district}, ` : ""}${listing.city}`);
  lines.push(
    `Price: ${listing.price.toLocaleString("en-US")} PLN (${listing.pricePerM2.toLocaleString("en-US")} PLN/m²)${
      listing.isNegotiable ? ", negotiable" : ""
    }`,
  );
  lines.push(`Area: ${listing.area} m², ${listing.rooms} room(s)`);
  lines.push(
    `Floor: ${listing.floor === 0 ? "ground floor" : listing.floor}${
      listing.totalFloors ? ` of ${listing.totalFloors}` : ""
    }, elevator: ${listing.hasElevator ? "yes" : "no"}`,
  );
  if (listing.yearBuilt) lines.push(`Year built: ${listing.yearBuilt}`);
  lines.push(`Market: ${listing.marketType}`);
  if (listing.buildingType) lines.push(`Building type: ${listing.buildingType}`);
  if (listing.ownershipForm) lines.push(`Ownership: ${listing.ownershipForm}`);
  if (listing.heating) lines.push(`Heating: ${listing.heating}`);
  lines.push(`Seller: ${listing.sellerType}`);
  if (listing.amenities.length > 0) lines.push(`Amenities: ${listing.amenities.join(", ")}`);

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You write short, factual summaries of real-estate listings for a property-search website.
Given a structured fact sheet for one flat, write a 2-3 sentence summary in English highlighting the
characteristics a prospective buyer would care about most: location, price (and price per m² if it
stands out), size/rooms, floor and elevator access, and any notable amenities or building details.
Use ONLY the facts given to you. Never invent details that are not present in the input. Do not use
markdown, headings, or bullet points — plain prose only.`;

// Calls the Gemini API to generate a short buyer-facing summary for a single listing.
export async function generateAiResume(listing: NormalizedListing, client: GoogleGenAI): Promise<string> {
  const prompt = buildPrompt(listing);
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const interaction = await client.interactions.create({
        model,
        input: prompt,
        system_instruction: SYSTEM_PROMPT,
        // "minimal" thinking: a short factual summary from already-structured
        // fields doesn't benefit from extended reasoning, and it's faster/cheaper.
        generation_config: { max_output_tokens: 200, thinking_level: "minimal" },
      });

      const text = interaction.output_text?.trim();
      if (!text) throw new Error("Empty response from model");
      return text;
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ApiError && (err.status === 429 || err.status >= 500);
      if (!retryable || attempt === MAX_RETRIES) break;
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError;
}
