# Reasoning — Smart Real Estate Listings Platform

## 1. What data did you decide to extract, and why
TODO

## 2. How you handled unstructured or low-quality data

**Rental ads misfiled under "for sale" (fixed):** one listing in the 105-item
raw fixture (`sourceId 73517952`, title *"PL/UK Bezposrednio wynajmę
mieszkanie..."* — "wynajmę" = "I rent out") turned up in the sprzedajemy.pl
**sale** search results despite being a **rental** ad. Its "price" (3,800
PLN) is a monthly rent figure, not a sale price — it parsed correctly as a
number, but is semantically wrong for a "for sale" listing (51 PLN/m² vs.
9,000+ PLN/m² for every other listing in the dataset). This wasn't a
scraping/parsing bug; the source page itself is miscategorized.

Fix: `lib/normalize/fields.ts` exports `isPlausibleSalePrice(pricePerM2)`,
which rejects listings below `MIN_PLAUSIBLE_SALE_PRICE_PER_M2` (1,000
PLN/m², chosen with headroom below the observed real-listing floor of
~9,000 PLN/m²). `scripts/normalize.ts` applies it as a post-normalization
filter and logs the exclusion with a reason instead of silently dropping it.
Result: 104/105 listings kept; the outlier is skipped and reported in the
`normalize` run summary.

**Known limitation:** this is a single hand-verified threshold, not a
general rental-vs-sale classifier — a legitimately cheap micro-studio in a
low-cost area could in theory fall under 1,000 PLN/m² and get excluded too.
Revisit if/when scaling past this fixture (e.g. cross-check against listing
title keywords that could be related to rental like "wynajmę"/"najem", or classify with AI if the heuristic starts producing false positives).

## 3. Where and why you used AI
TODO

## 4. One key assumption you made
TODO

## 5. One success metric for the product
TODO

## 6. One failure mode or limitation of your approach
TODO

## 7. What would you improve with more time
TODO
