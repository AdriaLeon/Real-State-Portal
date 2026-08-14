import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { toListingSummaryDto } from "../../../lib/api/listingDto.js";
import { buildListingOrderBy } from "../../../lib/api/listingFilters.js";
import { getMarketStats } from "../../../lib/api/marketStats.js";
import { parsePagination, parseStringParam, QueryParamError } from "../../../lib/api/queryParams.js";
import { parseSearchQuery } from "../../../lib/api/searchQueryParser.js";
import { getSearchVocabulary } from "../../../lib/api/searchVocabulary.js";
import { prisma } from "../db.js";

const router = Router();

// GET /search?q=<free text>&page=&limit=&sortBy=&sortOrder=
//
// Interprets `q` into filters (city, district, amenities, seller/market
// type, price/area bands — see lib/api/searchQueryParser.ts) and returns
// results in the same shape as GET /listings, plus a `detected` summary of
// what was picked up from the text.
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = parseStringParam(req.query.q, "q");
    if (!q) throw new QueryParamError('"q" is required and must not be blank');

    const [vocab, stats] = await Promise.all([getSearchVocabulary(), getMarketStats()]);
    const { where, detected } = parseSearchQuery(q, vocab, stats);
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
    });
  } catch (err) {
    next(err);
  }
});

export default router;
