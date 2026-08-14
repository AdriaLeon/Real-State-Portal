// City/district vocabulary used by the free-text search parser
// (searchQueryParser.ts) to detect location mentions in a query. Read from
// the DB (not hardcoded) so it always reflects whatever's actually been
// crawled/seeded, cached for the process lifetime like marketStats.ts.

import { prisma } from "../db/prisma.js";

export interface SearchVocabulary {
  cities: string[];
  districts: string[];
}

const globalForVocab = globalThis as unknown as {
  searchVocabulary?: SearchVocabulary;
  searchVocabularyPromise?: Promise<SearchVocabulary>;
};

async function computeSearchVocabulary(): Promise<SearchVocabulary> {
  const [cityRows, districtRows] = await Promise.all([
    prisma.listing.findMany({ distinct: ["city"], select: { city: true } }),
    prisma.listing.findMany({ distinct: ["district"], select: { district: true } }),
  ]);

  const vocab: SearchVocabulary = {
    cities: cityRows.map((r) => r.city),
    districts: districtRows.map((r) => r.district).filter((d): d is string => d !== null),
  };
  globalForVocab.searchVocabulary = vocab;
  return vocab;
}

export async function getSearchVocabulary(): Promise<SearchVocabulary> {
  if (globalForVocab.searchVocabulary) return globalForVocab.searchVocabulary;
  if (!globalForVocab.searchVocabularyPromise) {
    globalForVocab.searchVocabularyPromise = computeSearchVocabulary().catch((err) => {
      globalForVocab.searchVocabularyPromise = undefined;
      throw err;
    });
  }
  return globalForVocab.searchVocabularyPromise;
}

export function refreshSearchVocabulary(): Promise<SearchVocabulary> {
  globalForVocab.searchVocabulary = undefined;
  globalForVocab.searchVocabularyPromise = undefined;
  return getSearchVocabulary();
}
