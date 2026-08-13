// Parses the two embedded-JSON sources present on every sprzedajemy.pl
// detail page: the site's own `SPR.OfferJSON` inline script, and a standard
// schema.org JSON-LD block.

import * as cheerio from "cheerio";

export interface OfferJSON {
  offerPrice?: string; // e.g. "774630.00"
  accountType?: string; // e.g. "personal"
  goOfferProperties?: {
    priceAsNumber?: number;
    // customAttrIdValPairs deliberately NOT typed/used here: investigation
    // showed the same numeric id maps to different attribute meanings
    // across listings (depends on which optional attributes are present),
    // so it's not a stable field. The labeled .attribute-list text
    // (see attributes.ts) is the reliable source instead.
  };
}

export interface LdJsonOffer {
  name?: string;
  description?: string;
  image?: string[];
  offers?: {
    Price?: string;
  };
}


// Extracts and parses the `SPR.OfferJSON = {...};` inline script.
//
// This is NOT done with a regex like /SPR\.OfferJSON\s*=\s*(\{.*?\});/ —
// that breaks because the object contains nested braces (e.g.
// `goOfferProperties: {...}`), so a non-greedy match stops at the first
// inner "}" instead of the real end. Instead we find the opening brace and
// walk forward counting brace depth until it returns to zero.

export function extractOfferJSON(html: string): OfferJSON | null {
  const marker = "SPR.OfferJSON = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const json = extractBalancedObject(html, start + marker.length);
  if (!json) return null;

  try {
    return JSON.parse(json) as OfferJSON;
  } catch {
    return null;
  }
}

// Extracts and parses the `<script type="application/ld+json"
// class="offer-structured-data">` block (schema.org Product/Offer).

export function extractLdJson(html: string): LdJsonOffer | null {
  const $ = cheerio.load(html);
  const raw = $("script.offer-structured-data").first().text().trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LdJsonOffer;
  } catch {
    return null;
  }
}

// Scans forward from `startIdx` (which must point at a '{') and returns the
// substring up to and including the matching closing '}', tracking depth so
// nested objects don't terminate the match early.
function extractBalancedObject(str: string, startIdx: number): string | null {
  let depth = 0;
  for (let i = startIdx; i < str.length; i++) {
    if (str[i] === "{") depth++;
    else if (str[i] === "}") {
      depth--;
      if (depth === 0) return str.slice(startIdx, i + 1);
    }
  }
  return null;
}
