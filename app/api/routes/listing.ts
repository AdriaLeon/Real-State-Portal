import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { toListingDetailDto, toListingSummaryDto } from "../../../lib/api/listingDto.js";
import { buildListingOrderBy, buildListingWhere } from "../../../lib/api/listingFilters.js";
import { getListingFacets } from "../../../lib/api/listingFacets.js";
import { parsePagination } from "../../../lib/api/queryParams.js";
import { prisma } from "../db.js";

const router = Router();

// GET /listings?city=&district=&minPrice=&maxPrice=&minArea=&maxArea=
//               &minRooms=&maxRooms=&marketType=&sellerType=&hasElevator=
//               &buildingType=&ownershipForm=&sortBy=&sortOrder=&page=&limit=
//
// Returns the lightweight summary card per result (1 picture, price,
// location, size) — used by both search results and the home page.
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where = buildListingWhere(req.query);
    const orderBy = buildListingOrderBy(req.query);
    const { page, limit, skip } = parsePagination(req.query);

    const [rows, total] = await Promise.all([
      prisma.listing.findMany({ where, orderBy, skip, take: limit }),
      prisma.listing.count({ where }),
    ]);

    res.json({
      data: rows.map(toListingSummaryDto),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /listings/facets — distinct city/district/buildingType/ownershipForm
// values present in the data, for populating filter dropdowns. Registered
// before GET /listings/:id so "facets" isn't swallowed as an :id.
router.get("/facets", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const facets = await getListingFacets();
    res.json(facets);
  } catch (err) {
    next(err);
  }
});

// GET /listings/:id — id is the sourceId (String @id), not a numeric row id.
// Returns the full detail DTO for a single listing page.
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { sourceId: req.params.id } });
    if (!listing) {
      res.status(404).json({ error: `Listing "${req.params.id}" not found` });
      return;
    }
    res.json(toListingDetailDto(listing));
  } catch (err) {
    next(err);
  }
});

export default router;
