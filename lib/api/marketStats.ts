// Price/area percentile thresholds ("cheap", "expensive", "small", "big")
// used by the free-text search parser (searchQueryParser.ts). Computed once
// from a bulk fetch of every listing's price/area and cached for the process

import { prisma } from "../db/prisma.js";
import { percentile } from "./percentile.js";

export interface MarketStats {
  price: { p25: number; p75: number };
  area: { p25: number; p75: number };
}

const globalForStats = globalThis as unknown as {
  marketStats?: MarketStats;
  marketStatsPromise?: Promise<MarketStats>;
};

async function computeMarketStats(): Promise<MarketStats> {
  const rows = await prisma.listing.findMany({ select: { price: true, area: true } });
  const prices = rows.map((r) => r.price).sort((a, b) => a - b);
  const areas = rows.map((r) => r.area).sort((a, b) => a - b);

  const stats: MarketStats = {
    price: { p25: percentile(prices, 25), p75: percentile(prices, 75) },
    area: { p25: percentile(areas, 25), p75: percentile(areas, 75) },
  };
  globalForStats.marketStats = stats;
  return stats;
}

export async function getMarketStats(): Promise<MarketStats> {
  if (globalForStats.marketStats) return globalForStats.marketStats;
  if (!globalForStats.marketStatsPromise) {
    globalForStats.marketStatsPromise = computeMarketStats().catch((err) => {
      // Don't let a transient DB error at boot permanently wedge the cache
      // into rejecting forever.
      globalForStats.marketStatsPromise = undefined;
      throw err;
    });
  }
  return globalForStats.marketStatsPromise;
}

export function refreshMarketStats(): Promise<MarketStats> {
  globalForStats.marketStats = undefined;
  globalForStats.marketStatsPromise = undefined;
  return getMarketStats();
}
