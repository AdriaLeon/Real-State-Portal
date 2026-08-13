// Normalization.
//
// Reads the raw HTML fixtures captured by scripts/crawl.ts and parses them
// into structured, typed listings the web app can display and filter on.
// Entirely deterministic HTML parsing — no AI, no network access.
//
// Usage: npm run normalize

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeListing, type NormalizedListing, type RawListing } from "../lib/normalize/normalizeListing.js";
import { isPlausibleSalePrice } from "../lib/normalize/fields.js";

const INPUT_PATH = path.resolve("prisma/seed-data/raw-listings.json");
const OUTPUT_PATH = path.resolve("prisma/seed-data/listings.json");

async function main() {
  const raw = JSON.parse(await readFile(INPUT_PATH, "utf-8")) as RawListing[];
  console.log(`Loaded ${raw.length} raw listings from ${INPUT_PATH}`);

  const normalized: NormalizedListing[] = [];
  const skipped: { sourceId: string; reason: string }[] = [];

  for (const item of raw) {
    try {
      const listing = normalizeListing(item);
      if (!isPlausibleSalePrice(listing.pricePerM2)) {
        skipped.push({
          sourceId: item.sourceId,
          reason: `Anomalous low sale price (${listing.pricePerM2} PLN/m²) — likely a rental ad misfiled under "for sale"`,
        });
        continue;
      }
      normalized.push(listing);
    } catch (err) {
      skipped.push({ sourceId: item.sourceId, reason: (err as Error).message });
    }
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(normalized, null, 2), "utf-8");

  console.log("\nDone.");
  console.log(`  Normalized: ${normalized.length}/${raw.length}`);
  if (skipped.length > 0) {
    console.log(`  Skipped: ${skipped.length}`);
    for (const s of skipped) console.log(`    - ${s.sourceId}: ${s.reason}`);
  }
  console.log(`  Output: ${OUTPUT_PATH}`);

  if (normalized.length > 0) {
    const prices = normalized.map((l) => l.price);
    const byCity = normalized.reduce<Record<string, number>>((acc, l) => {
      acc[l.city] = (acc[l.city] ?? 0) + 1;
      return acc;
    }, {});
    const withElevator = normalized.filter((l) => l.hasElevator).length;

    console.log("\nSanity check:");
    console.log(`  Price range: ${Math.min(...prices).toLocaleString()} - ${Math.max(...prices).toLocaleString()} PLN`);
    console.log(`  Avg price: ${Math.round(prices.reduce((a, b) => a + b, 0) / prices.length).toLocaleString()} PLN`);
    console.log(`  By city: ${JSON.stringify(byCity)}`);
    console.log(`  With elevator: ${withElevator}/${normalized.length}`);
  }
}

main().catch((err) => {
  console.error("Normalize failed:", err);
  process.exitCode = 1;
});
