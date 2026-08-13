// Data acquisition.
//
// Fetches ~105 individual flat-for-sale listings from sprzedajemy.pl across a
// few cities and stores them as RAW, unparsed HTML fixtures in
// prisma/seed-data/raw-listings.json. Field-level extraction (price, area,
// rooms, ...) is intentionally NOT done here, that's scripts/normalize.ts.
//
// Usage: npm run crawl

import * as cheerio from "cheerio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Target cities to crawl. Each city is a slug used in the URL path on sprzedajemy.pl.
const CITIES = [
  { name: "Kraków", slug: "krakow" },
  { name: "Warszawa", slug: "warszawa" },
  { name: "Wrocław", slug: "wroclaw" },
] as const;

// Get 35 flats per city
const LISTINGS_PER_CITY = 35;
const RESULTS_PER_PAGE = 30;
const MAX_PAGES_PER_CITY = 6; // safety cap

// Randomized delay between requests to avoid hammering the server and to reduce the chance of being blocked. The delay is jittered between MIN_DELAY_MS and MAX_DELAY_MS.
const MIN_DELAY_MS = 800;
const MAX_DELAY_MS = 1500;

const OUTPUT_PATH = path.resolve("prisma/seed-data/raw-listings.json");

// Shape of the saved records
interface RawListing {
  source: "sprzedajemy";
  sourceId: string;
  url: string;
  city: string;
  html: string;
  fetchedAt: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitterDelay() {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

// Extract the numeric "nr<digits>" suffix sprzedajemy.pl uses as a listing id.
function extractSourceId(href: string): string | null {
  const match = href.match(/nr(\d+)$/);
  return match ? match[1] : null;
}

// Collect unique detail-page URLs for a city by walking paginated search results.
async function collectListingUrls(citySlug: string, target: number): Promise<Map<string, string>> {
  const found = new Map<string, string>(); // sourceId -> absolute url

  for (let page = 0; page < MAX_PAGES_PER_CITY && found.size < target; page++) {
    const offset = page * RESULTS_PER_PAGE;
    const searchUrl = `https://sprzedajemy.pl/${citySlug}/nieruchomosci/mieszkania/sprzedaz?offset=${offset}`;

    console.log(`  [search] ${citySlug} offset=${offset} (have ${found.size}/${target})`);
    let html: string;
    try {
      html = await fetchHtml(searchUrl);
    } catch (err) {
      console.warn(`  [search] failed, skipping page: ${(err as Error).message}`);
      break;
    }

    const $ = cheerio.load(html);
    const hrefs = $("a.offerLink")
      .map((_, el) => $(el).attr("href"))
      .get()
      .filter((href): href is string => Boolean(href));

    if (hrefs.length === 0) {
      console.log(`  [search] no more results, stopping pagination for ${citySlug}`);
      break;
    }

    for (const href of hrefs) {
      const sourceId = extractSourceId(href);
      if (!sourceId || found.has(sourceId)) continue;
      const absoluteUrl = href.startsWith("http") ? href : `https://sprzedajemy.pl${href}`;
      found.set(sourceId, absoluteUrl);
      if (found.size >= target) break;
    }

    await sleep(jitterDelay());
  }

  return found;
}

async function loadExisting(): Promise<RawListing[]> {
  try {
    const content = await readFile(OUTPUT_PATH, "utf-8");
    return JSON.parse(content) as RawListing[];
  } catch {
    return [];
  }
}

async function saveResults(listings: RawListing[]) {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(listings, null, 2), "utf-8");
}

async function main() {
  const existing = await loadExisting();
  const seenIds = new Set(existing.map((l) => l.sourceId));
  const results: RawListing[] = [...existing];

  console.log(`Starting crawl. ${existing.length} listings already saved from a previous run.`);

  // Collect candidate URLs per city.
  const urlsByCity = new Map<string, Map<string, string>>();
  let totalCandidates = 0;
  for (const city of CITIES) {
    console.log(`Collecting listing URLs for ${city.name}...`);
    const urls = await collectListingUrls(city.slug, LISTINGS_PER_CITY);
    urlsByCity.set(city.name, urls);
    totalCandidates += urls.size;
    console.log(`  -> found ${urls.size} candidate URLs for ${city.name}`);
  }

  // Fetch each detail page sequentially, skipping ones we already have.
  let fetched = 0;
  let failed = 0;
  const target = totalCandidates;

  for (const city of CITIES) {
    const urls = urlsByCity.get(city.name)!;
    for (const [sourceId, url] of urls) {
      if (seenIds.has(sourceId)) {
        console.log(`  [skip] ${sourceId} already saved`);
        continue;
      }

      try {
        const html = await fetchHtml(url);
        results.push({
          source: "sprzedajemy",
          sourceId,
          url,
          city: city.name,
          html,
          fetchedAt: new Date().toISOString(),
        });
        seenIds.add(sourceId);
        fetched++;
        console.log(`  [${results.length}/${target + existing.length}] fetched ${sourceId} (${city.name})`);

        // Write-through every 10 successful fetches so a crash mid-run doesn't lose progress.
        if (fetched % 10 === 0) {
          await saveResults(results);
        }
      } catch (err) {
        failed++;
        console.warn(`  [fail] ${sourceId}: ${(err as Error).message}`);
      }

      await sleep(jitterDelay());
    }
  }

  await saveResults(results);

  console.log("\nDone.");
  console.log(`  Total listings in fixture: ${results.length}`);
  console.log(`  Fetched this run: ${fetched}`);
  console.log(`  Failed this run: ${failed}`);
  console.log(`  Output: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Crawl failed:", err);
  process.exitCode = 1;
});