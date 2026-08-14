import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { getGeminiClient } from "../../../lib/ai/geminiClient.js";
import { aiFiltersToWhere, parseSearchQueryAI, type AIDetectedFilters } from "../../../lib/ai/searchQueryAI.js";
import { toListingSummaryDto } from "../../../lib/api/listingDto.js";
import { buildListingOrderBy } from "../../../lib/api/listingFilters.js";
import { getListingFacets } from "../../../lib/api/listingFacets.js";
import { getMarketStats } from "../../../lib/api/marketStats.js";
import { parseEnumParam, parsePagination, parseStringParam, QueryParamError } from "../../../lib/api/queryParams.js";
import { parseSearchQuery, type DetectedFilters } from "../../../lib/api/searchQueryParser.js";
import { getSearchVocabulary } from "../../../lib/api/searchVocabulary.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../db.js";

const router = Router();

const SEARCH_MODES = ["keyword", "ai"] as const;
type SearchMode = (typeof SEARCH_MODES)[number];

const AI_UNAVAILABLE_WARNING =
  "AI search is currently unavailable — check the Gemini API key/configuration. Showing keyword search results instead.";

// GET /search?q=<free text>&page=&limit=&sortBy=&sortOrder=&mode=keyword|ai
//
// Interprets `q` into filters and returns results in the same shape as
// GET /listings, plus a `detected` summary of what was picked up from the
// text. `mode=keyword` (default) uses regex/vocabulary matching, limited to
// city, district, amenities, seller/market type, and relative price/area
// bands (lib/api/searchQueryParser.ts). `mode=ai` asks Gemini to do the
// same job but with the FULL filter set FilterPanel offers — building
// type, ownership form, and numeric price/area/room ranges too
// (lib/ai/searchQueryAI.ts). If AI mode fails for any reason, this falls
// back to the keyword parser and reports it via `warning` rather than
// failing the request outright.
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = parseStringParam(req.query.q, "q");
    if (!q) throw new QueryParamError('"q" is required and must not be blank');
    const requestedMode = parseEnumParam(req.query.mode, "mode", SEARCH_MODES) ?? "keyword";

    const [vocab, stats] = await Promise.all([getSearchVocabulary(), getMarketStats()]);

    let mode: SearchMode = "keyword";
    let detected: DetectedFilters | AIDetectedFilters;
    let where: Prisma.ListingWhereInput;
    let warning: string | null = null;

    if (requestedMode === "ai") {
      try {
        const facets = await getListingFacets();
        const aiDetected = await parseSearchQueryAI(q, facets, stats, getGeminiClient());
        detected = aiDetected;
        where = aiFiltersToWhere(aiDetected);
        mode = "ai";
      } catch (err) {
        console.error(err);
        const parsed = parseSearchQuery(q, vocab, stats);
        detected = parsed.detected;
        where = parsed.where;
        warning = AI_UNAVAILABLE_WARNING;
      }
    } else {
      const parsed = parseSearchQuery(q, vocab, stats);
      detected = parsed.detected;
      where = parsed.where;
    }

    const orderBy = buildListingOrderBy(req.query);
    const { page, limit, skip } = parsePagination(req.query);

    const [rows, total] = await Promise.all([
      prisma.listing.findMany({ where, orderBy, skip, take: limit }),
      prisma.listing.count({ where }),
    ]);

    res.json({
      data: rows.map(toListingSummaryDto),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      detected,
      mode,
      warning,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
