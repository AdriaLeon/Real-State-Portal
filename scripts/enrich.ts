// AI enrichment.
//
// Reads the deterministically-normalized listings and generates a short
// buyer-facing summary ("AI_resume") for each one via the Gemini API,
// cached by a content hash so unchanged listings aren't re-summarized (and
// re-billed) on subsequent runs.
//
// Usage: npm run enrich

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, GoogleGenAI } from "@google/genai";
import { computeContentHash, generateAiResume } from "../lib/ai/summarize.js";
import type { NormalizedListing } from "../lib/normalize/normalizeListing.js";

const INPUT_PATH = path.resolve("prisma/seed-data/listings.json");
const OUTPUT_PATH = path.resolve("prisma/seed-data/enriched-listings.json");

// Small jittered delay between live API calls.
const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 500;

// If this much time passes with 429s and not a single successful summary,
// assume the quota is exhausted for this run. Once tripped, stop calling
// the API entirely and fill the rest of the run with null summaries. See
// REASONING.md (known limitation: free-tier quota).
const QUOTA_EXHAUSTED_IDLE_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

export interface EnrichedListing extends NormalizedListing {
  AI_resume: string | null;
  contentHash: string | null;
}

async function loadExisting(): Promise<Map<string, EnrichedListing>> {
  try {
    const content = await readFile(OUTPUT_PATH, "utf-8");
    const items = JSON.parse(content) as EnrichedListing[];
    return new Map(items.map((item) => [item.sourceId, item]));
  } catch {
    return new Map();
  }
}

async function saveResults(listings: EnrichedListing[]) {
  await writeFile(OUTPUT_PATH, JSON.stringify(listings, null, 2), "utf-8");
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env (see .env.example) before running `npm run enrich`.");
  }

  const normalized = JSON.parse(await readFile(INPUT_PATH, "utf-8")) as NormalizedListing[];
  console.log(`Loaded ${normalized.length} normalized listings from ${INPUT_PATH}`);

  const cache = await loadExisting();
  console.log(`Loaded ${cache.size} previously-enriched listings from ${OUTPUT_PATH}`);

  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const results: EnrichedListing[] = [];
  const failed: { sourceId: string; reason: string }[] = [];
  let generated = 0;
  let cached = 0;
  let skippedQuota = 0;
  let sinceLastSave = 0;
  let quotaExhausted = false;
  // Updated on every successful generation; used to measure how long we've
  // gone without one.
  let lastGeneratedAt = Date.now();

  for (const listing of normalized) {
    const contentHash = computeContentHash(listing);
    const cachedEntry = cache.get(listing.sourceId);

    if (cachedEntry && cachedEntry.contentHash === contentHash) {
      results.push(cachedEntry);
      cached++;
      continue;
    }

    if (quotaExhausted) {
      results.push({ ...listing, AI_resume: null, contentHash: null });
      skippedQuota++;
      continue;
    }

    try {
      const AI_resume = await generateAiResume(listing, client);
      results.push({ ...listing, AI_resume, contentHash });
      generated++;
      sinceLastSave++;
      lastGeneratedAt = Date.now();
      console.log(`  [${results.length}/${normalized.length}] generated summary for ${listing.sourceId}`);

      // Write-through every 10 fresh calls so a crash mid-run doesn't lose
      // (or force re-paying for) work already done.
      if (sinceLastSave >= 10) {
        await saveResults(results);
        sinceLastSave = 0;
      }

      await sleep(jitterDelay());
    } catch (err) {
      failed.push({ sourceId: listing.sourceId, reason: (err as Error).message });
      console.warn(`  [fail] ${listing.sourceId}: ${(err as Error).message}`);

      // Keep the dataset complete even when the call fails: include the
      // listing with AI_resume: null rather than dropping it. contentHash
      // is left null so a future run (e.g. after the quota resets) retries.
      results.push({ ...listing, AI_resume: null, contentHash: null });

      if (err instanceof ApiError && err.status === 429) {
        const idleMs = Date.now() - lastGeneratedAt;
        if (idleMs >= QUOTA_EXHAUSTED_IDLE_MS) {
          quotaExhausted = true;
          console.warn(
            `  No successful summary in the last ${Math.round(idleMs / 1000)}s (still getting 429s) — quota appears exhausted; filling the rest of the run with AI_resume: null instead of continuing to call the API.`,
          );
        }
      }
    }
  }

  await saveResults(results);

  console.log("\nDone.");
  console.log(`  Total listings: ${normalized.length}`);
  console.log(`  Generated (fresh API call): ${generated}`);
  console.log(`  Cached (reused): ${cached}`);
  if (skippedQuota > 0) {
    console.log(`  Skipped (quota exhausted, AI_resume: null): ${skippedQuota}`);
  }
  if (failed.length > 0) {
    console.log(`  Failed: ${failed.length}`);
    for (const f of failed) console.log(`    - ${f.sourceId}: ${f.reason}`);
  }
  console.log(`  Output: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Enrich failed:", err);
  process.exitCode = 1;
});
