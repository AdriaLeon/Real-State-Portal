// Database seeding.
//
// Loads the pipeline's final output (prisma/seed-data/enriched-listings.json)
// and upserts it into MySQL via Prisma Client, so the data is queryable by a
// future API.
//
//
// Usage: npm run db:seed
// (requires the mysql container running — `docker compose up -d` — and
// migrations applied — `npm run db:migrate`)

import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/db/prisma.js";
import type { EnrichedListing } from "./enrich.js";

const INPUT_PATH = path.resolve("prisma/seed-data/enriched-listings.json");

async function main() {
  const enriched = JSON.parse(await readFile(INPUT_PATH, "utf-8")) as EnrichedListing[];
  console.log(`Loaded ${enriched.length} enriched listings from ${INPUT_PATH}`);

  let upserted = 0;
  const failed: { sourceId: string; reason: string }[] = [];

  for (const item of enriched) {
    try {
      const data = {
        source: item.source,
        url: item.url,
        title: item.title,
        description: item.description,
        city: item.city,
        district: item.district,
        price: item.price,
        pricePerM2: item.pricePerM2,
        isNegotiable: item.isNegotiable,
        area: item.area,
        rooms: item.rooms,
        floor: item.floor,
        totalFloors: item.totalFloors,
        yearBuilt: item.yearBuilt,
        marketType: item.marketType,
        buildingType: item.buildingType,
        ownershipForm: item.ownershipForm,
        heating: item.heating,
        sellerType: item.sellerType,
        hasElevator: item.hasElevator,
        amenities: item.amenities,
        images: item.images,
        imageCount: item.imageCount,
        AI_resume: item.AI_resume,
        contentHash: item.contentHash,
        fetchedAt: new Date(item.fetchedAt),
        normalizedAt: new Date(item.normalizedAt),
      };
      await prisma.listing.upsert({
        where: { sourceId: item.sourceId },
        create: { sourceId: item.sourceId, ...data },
        update: data,
      });
      upserted++;
    } catch (err) {
      failed.push({ sourceId: item.sourceId, reason: (err as Error).message });
      console.warn(`  [fail] ${item.sourceId}: ${(err as Error).message}`);
    }
  }

  const missingResume = enriched.filter((l) => l.AI_resume === null).length;

  console.log("\nDone.");
  console.log(`  Upserted: ${upserted}/${enriched.length}`);
  if (failed.length > 0) {
    console.log(`  Failed: ${failed.length}`);
    for (const f of failed) console.log(`    - ${f.sourceId}: ${f.reason}`);
  }
  console.log(
    `  Rows with AI_resume: NULL: ${missingResume}/${enriched.length} (re-run \`npm run enrich\` then \`npm run db:seed\` to backfill)`,
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
