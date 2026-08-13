// Parses the two plain-HTML sources of structured data on a sprzedajemy.pl
// detail page: the labeled attribute table and the free-text amenity tags.
//
// Both are simple, deterministic markup (confirmed across all 105 raw
// fixtures).

import * as cheerio from "cheerio";


// Parses `.attributes-box .attribute-list li.item` into a label -> value map.
//
// Markup shape:
//   <li class="item"><span>Powierzchnia</span><strong>51.3 m²</strong></li>
//
// Optional attributes (e.g. "Ogrzewanie", "Materiał budynku") are simply
// absent from the list when the seller didn't set them — callers must treat
// missing keys as "unknown", not as a parsing failure.

export function parseAttributeList(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const pairs: Record<string, string> = {};

  $(".attribute-list li.item").each((_, el) => {
    const label = $(el).find("span").first().text().trim();
    const value = $(el).find("strong").first().text().trim();
    if (label) pairs[label] = value;
  });

  return pairs;
}


// Parses `.additional-parameters li span` into a flat list of free-text
// amenity tags (Polish), e.g. ["winda", "balkon", "miejsce parkingowe"].
//
// This block is optional — listings with no extra amenities simply don't
// have the container, so this returns [] rather than throwing.

export function parseAmenities(html: string): string[] {
  const $ = cheerio.load(html);
  return $(".additional-parameters li span")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
}

// Parses the breadcrumb trail (`#cntNavPath .cntPath .inline span`) and
// returns the last (most specific) crumb's raw text, e.g.
// "Mieszkania na sprzedaż Kraków Płaszów". Returns null if no breadcrumb is
// found at all (shouldn't happen in practice, but this is scraped HTML).

export function parseLastBreadcrumb(html: string): string | null {
  const $ = cheerio.load(html);
  const crumbs = $("#cntNavPath .cntPath .inline span")
    .map((_, el) => $(el).text().trim())
    .get();
  return crumbs.length > 0 ? crumbs[crumbs.length - 1] : null;
}

// True if the listing has a "do negocjacji" (negotiable price) badge.
export function parseIsNegotiable(html: string): boolean {
  const $ = cheerio.load(html);
  return $(".price-is-negotiable").length > 0;
}
