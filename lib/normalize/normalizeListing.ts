// Combines the raw-HTML parsers into one fully-typed NormalizedListing per
// raw fixture entry. This is the single function scripts/normalize.ts calls
// per listing.

import { parseAmenities, parseAttributeList, parseIsNegotiable, parseLastBreadcrumb } from "./attributes.js";
import { extractLdJson, extractOfferJSON } from "./structuredData.js";
import {
  mapBuildingType,
  mapMarketType,
  mapSellerType,
  parseArea,
  parseDistrict,
  parseFloor,
  parsePrice,
  parseTotalFloors,
  parseYearBuilt,
} from "./fields.js";

export interface RawListing {
  source: "sprzedajemy";
  sourceId: string;
  url: string;
  city: string;
  html: string;
  fetchedAt: string;
}

export interface NormalizedListing {
  sourceId: string;
  source: "sprzedajemy";
  url: string;
  title: string;
  description: string;
  city: string;
  district: string | null;
  price: number; // PLN, total
  pricePerM2: number; // PLN
  isNegotiable: boolean;
  area: number; // m²
  rooms: number;
  floor: number; // 0 = parter/ground floor
  totalFloors: number | null;
  yearBuilt: number | null;
  marketType: "primary" | "secondary";
  buildingType: string | null;
  ownershipForm: string | null;
  heating: string | null;
  sellerType: "private" | "agency";
  hasElevator: boolean;
  amenities: string[];
  images: string[];
  imageCount: number;
  fetchedAt: string;
  normalizedAt: string;
}

export function normalizeListing(raw: RawListing): NormalizedListing {
  const attrs = parseAttributeList(raw.html);
  const amenities = parseAmenities(raw.html);
  const ldJson = extractLdJson(raw.html);
  const offerJson = extractOfferJSON(raw.html);

  if (!attrs["Powierzchnia"]) throw new Error(`Missing "Powierzchnia" attribute for ${raw.sourceId}`);
  if (!attrs["Liczba pokoi"]) throw new Error(`Missing "Liczba pokoi" attribute for ${raw.sourceId}`);
  if (!attrs["Piętro"]) throw new Error(`Missing "Piętro" attribute for ${raw.sourceId}`);

  // Price: prefer the numeric SPR.OfferJSON value, fall back to ld+json.
  // Cross-check the two instead of trusting either blindly; a mismatch is
  // logged (not fatal) since it likely just means one source lagged a stale
  // cache, not that the listing is corrupt.
  const priceFromOfferJson = offerJson?.goOfferProperties?.priceAsNumber ?? null;
  const priceFromLdJson = ldJson?.offers?.Price ? Math.round(parseFloat(ldJson.offers.Price)) : null;
  const price = priceFromOfferJson ?? priceFromLdJson;
  if (price == null) throw new Error(`Could not determine price for ${raw.sourceId}`);
  if (priceFromOfferJson != null && priceFromLdJson != null && priceFromOfferJson !== priceFromLdJson) {
    console.warn(
      `Price mismatch for ${raw.sourceId}: OfferJSON=${priceFromOfferJson} vs ldJson=${priceFromLdJson}, using ${price}`,
    );
  }

  const district = parseDistrict(parseLastBreadcrumb(raw.html), raw.city);

  return {
    sourceId: raw.sourceId,
    source: raw.source,
    url: raw.url,
    title: ldJson?.name?.trim() || "",
    description: ldJson?.description?.trim() || "",
    city: raw.city,
    district,
    price,
    pricePerM2: attrs["Cena za m²"] ? parsePrice(attrs["Cena za m²"]) : Math.round(price / parseArea(attrs["Powierzchnia"])),
    isNegotiable: parseIsNegotiable(raw.html),
    area: parseArea(attrs["Powierzchnia"]),
    rooms: parseInt(attrs["Liczba pokoi"], 10),
    floor: parseFloor(attrs["Piętro"]),
    totalFloors: parseTotalFloors(attrs["Liczba pięter"]),
    yearBuilt: parseYearBuilt(attrs["Rok budowy"]),
    marketType: mapMarketType(attrs["Rynek"]),
    buildingType: mapBuildingType(attrs["Zabudowa"]),
    ownershipForm: attrs["Forma własności"]?.trim() || null,
    heating: attrs["Ogrzewanie"]?.trim() || null,
    sellerType: mapSellerType(attrs["Oferta od"]),
    hasElevator: amenities.includes("winda"),
    amenities,
    images: ldJson?.image ?? [],
    imageCount: ldJson?.image?.length ?? 0,
    fetchedAt: raw.fetchedAt,
    normalizedAt: new Date().toISOString(),
  };
}
