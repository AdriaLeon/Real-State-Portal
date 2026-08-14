// Distinct filter-option values (city, district, building type, ownership
// form) used to populate the frontend's filter dropdowns with real data
// instead of free text. Read from the DB so options always reflect
// whatever's actually been crawled/seeded, cached for the process lifetime
// like searchVocabulary.ts / marketStats.ts.

import { prisma } from "../db/prisma.js";

export interface ListingFacets {
  cities: string[];
  districts: string[];
  buildingTypes: string[];
  ownershipForms: string[];
}

const globalForFacets = globalThis as unknown as {
  listingFacets?: ListingFacets;
  listingFacetsPromise?: Promise<ListingFacets>;
};

function sortedUnique(values: (string | null)[]): string[] {
  const unique = new Set(values.filter((v): v is string => v !== null && v !== ""));
  return [...unique].sort((a, b) => a.localeCompare(b));
}

async function computeListingFacets(): Promise<ListingFacets> {
  const [cityRows, districtRows, buildingTypeRows, ownershipFormRows] = await Promise.all([
    prisma.listing.findMany({ distinct: ["city"], select: { city: true } }),
    prisma.listing.findMany({ distinct: ["district"], select: { district: true } }),
    prisma.listing.findMany({ distinct: ["buildingType"], select: { buildingType: true } }),
    prisma.listing.findMany({ distinct: ["ownershipForm"], select: { ownershipForm: true } }),
  ]);

  const facets: ListingFacets = {
    cities: sortedUnique(cityRows.map((r) => r.city)),
    districts: sortedUnique(districtRows.map((r) => r.district)),
    buildingTypes: sortedUnique(buildingTypeRows.map((r) => r.buildingType)),
    ownershipForms: sortedUnique(ownershipFormRows.map((r) => r.ownershipForm)),
  };
  globalForFacets.listingFacets = facets;
  return facets;
}

export async function getListingFacets(): Promise<ListingFacets> {
  if (globalForFacets.listingFacets) return globalForFacets.listingFacets;
  if (!globalForFacets.listingFacetsPromise) {
    globalForFacets.listingFacetsPromise = computeListingFacets().catch((err) => {
      globalForFacets.listingFacetsPromise = undefined;
      throw err;
    });
  }
  return globalForFacets.listingFacetsPromise;
}
