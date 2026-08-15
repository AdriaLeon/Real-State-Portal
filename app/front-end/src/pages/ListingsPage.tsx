import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getListings } from "../api/listings";
import { search } from "../api/search";
import { ApiError } from "../api/client";
import type { ListingFilters } from "../types/filters";
import type { ListingSummaryDto } from "../types/listing";
import type { PaginationMeta } from "../types/pagination";
import type { AIDetectedFilters, DetectedFilters, SearchMode } from "../types/search";
import ListingCard from "../components/ListingCard";
import styles from "./styles/ListingsPage.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      listings: ListingSummaryDto[];
      pagination: PaginationMeta;
      detected: DetectedFilters | AIDetectedFilters | null;
      // The mode the backend actually used to produce `detected` — may
      // differ from the requested mode on an AI fallback (see `warning`).
      // Needed to know which of DetectedFilters/AIDetectedFilters this is.
      resultMode: SearchMode | null;
      warning: string | null;
    };

// Reads the filters HomePage's FilterPanel encoded into the query string
// back out into a typed ListingFilters — keeps the URL as the single source
// of truth so results are shareable/bookmarkable and survive a page reload.
function parseFiltersFromSearchParams(params: URLSearchParams): ListingFilters {
  const filters: ListingFilters = {};

  const city = params.get("city");
  if (city) filters.city = city;
  const district = params.get("district");
  if (district) filters.district = district;
  const buildingType = params.get("buildingType");
  if (buildingType) filters.buildingType = buildingType;
  const ownershipForm = params.get("ownershipForm");
  if (ownershipForm) filters.ownershipForm = ownershipForm;

  const minPrice = params.get("minPrice");
  if (minPrice) filters.minPrice = Number(minPrice);
  const maxPrice = params.get("maxPrice");
  if (maxPrice) filters.maxPrice = Number(maxPrice);
  const minArea = params.get("minArea");
  if (minArea) filters.minArea = Number(minArea);
  const maxArea = params.get("maxArea");
  if (maxArea) filters.maxArea = Number(maxArea);
  const minRooms = params.get("minRooms");
  if (minRooms) filters.minRooms = Number(minRooms);
  const maxRooms = params.get("maxRooms");
  if (maxRooms) filters.maxRooms = Number(maxRooms);

  // Floor uses an explicit presence check (unlike rooms/price/area above) because 0
  // (ground floor) is a real, common filter value that a truthy check would silently drop.
  const minFloorRaw = params.get("minFloor");
  if (minFloorRaw !== null) filters.minFloor = Number(minFloorRaw);
  const maxFloorRaw = params.get("maxFloor");
  if (maxFloorRaw !== null) filters.maxFloor = Number(maxFloorRaw);

  const marketType = params.get("marketType");
  if (marketType === "primary" || marketType === "secondary") filters.marketType = marketType;
  const sellerType = params.get("sellerType");
  if (sellerType === "private" || sellerType === "agency") filters.sellerType = sellerType;
  const hasElevator = params.get("hasElevator");
  if (hasElevator === "true" || hasElevator === "false") filters.hasElevator = hasElevator === "true";

  const page = params.get("page");
  if (page) filters.page = Number(page);

  return filters;
}

// Human-readable summary of the active filters, shown above the results so
// it's clear what's being searched for.
function describeFilters(filters: ListingFilters): string[] {
  const chips: string[] = [];
  if (filters.city) chips.push(`City: ${filters.city}`);
  if (filters.district) chips.push(`District: ${filters.district}`);
  if (filters.minPrice) chips.push(`Min price: ${filters.minPrice.toLocaleString("pl-PL")} PLN`);
  if (filters.maxPrice) chips.push(`Max price: ${filters.maxPrice.toLocaleString("pl-PL")} PLN`);
  if (filters.minArea) chips.push(`Min area: ${filters.minArea} m²`);
  if (filters.maxArea) chips.push(`Max area: ${filters.maxArea} m²`);
  if (filters.minRooms) chips.push(`Min rooms: ${filters.minRooms}`);
  if (filters.maxRooms) chips.push(`Max rooms: ${filters.maxRooms}`);
  if (filters.minFloor !== undefined) chips.push(`Min floor: ${filters.minFloor}`);
  if (filters.maxFloor !== undefined) chips.push(`Max floor: ${filters.maxFloor}`);
  if (filters.marketType) chips.push(filters.marketType === "primary" ? "Primary market" : "Secondary market");
  if (filters.sellerType) chips.push(filters.sellerType === "agency" ? "Agency" : "Private seller");
  if (filters.hasElevator !== undefined) chips.push(filters.hasElevator ? "Has elevator" : "No elevator");
  if (filters.buildingType) chips.push(`Building: ${filters.buildingType}`);
  if (filters.ownershipForm) chips.push(`Ownership: ${filters.ownershipForm}`);
  return chips;
}

// Same idea, but for what GET /search detected out of the free-text query
// — every one of these fields actually constrained the results (see
// api/search.ts), so this is a true description of what's filtering.
function describeDetectedFilters(detected: DetectedFilters): string[] {
  const chips: string[] = [];
  if (detected.city) chips.push(`City: ${detected.city}`);
  if (detected.district) chips.push(`District: ${detected.district}`);
  if (detected.priceBand === "cheap") chips.push("Cheap");
  if (detected.priceBand === "expensive") chips.push("Expensive");
  if (detected.areaBand === "small") chips.push("Small");
  if (detected.areaBand === "big") chips.push("Big");
  if (detected.minRooms != null) chips.push(`Min rooms: ${detected.minRooms}`);
  if (detected.maxRooms != null) chips.push(`Max rooms: ${detected.maxRooms}`);
  if (detected.minFloor != null) chips.push(`Min floor: ${detected.minFloor}`);
  if (detected.maxFloor != null) chips.push(`Max floor: ${detected.maxFloor}`);
  if (detected.marketType) chips.push(detected.marketType === "primary" ? "Primary market" : "Secondary market");
  if (detected.sellerType) chips.push(detected.sellerType === "agency" ? "Agency" : "Private seller");
  if (detected.hasElevator) chips.push("Has elevator");
  for (const amenity of detected.amenities) chips.push(`Amenity: ${amenity}`);
  return chips;
}

// AI-mode counterpart of describeDetectedFilters — covers the wider filter
// set AIDetectedFilters can carry (building type, ownership form, and
// numeric price/area/room/floor ranges instead of just relative bands).
function describeAIDetectedFilters(detected: AIDetectedFilters): string[] {
  const chips: string[] = [];
  if (detected.city) chips.push(`City: ${detected.city}`);
  if (detected.district) chips.push(`District: ${detected.district}`);
  if (detected.buildingType) chips.push(`Building: ${detected.buildingType}`);
  if (detected.ownershipForm) chips.push(`Ownership: ${detected.ownershipForm}`);
  if (detected.minPrice != null) chips.push(`Min price: ${detected.minPrice.toLocaleString("pl-PL")} PLN`);
  if (detected.maxPrice != null) chips.push(`Max price: ${detected.maxPrice.toLocaleString("pl-PL")} PLN`);
  if (detected.minArea != null) chips.push(`Min area: ${detected.minArea} m²`);
  if (detected.maxArea != null) chips.push(`Max area: ${detected.maxArea} m²`);
  if (detected.minRooms != null) chips.push(`Min rooms: ${detected.minRooms}`);
  if (detected.maxRooms != null) chips.push(`Max rooms: ${detected.maxRooms}`);
  if (detected.minFloor != null) chips.push(`Min floor: ${detected.minFloor}`);
  if (detected.maxFloor != null) chips.push(`Max floor: ${detected.maxFloor}`);
  if (detected.marketType) chips.push(detected.marketType === "primary" ? "Primary market" : "Secondary market");
  if (detected.sellerType) chips.push(detected.sellerType === "agency" ? "Agency" : "Private seller");
  if (detected.hasElevator) chips.push("Has elevator");
  for (const amenity of detected.amenities) chips.push(`Amenity: ${amenity}`);
  return chips;
}

export default function ListingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // `q` (from SearchBar) and structured filters (from FilterPanel) are
  // mutually exclusive request modes — the backend's GET /search ignores
  // filter params entirely, so whichever produced this URL wins outright.
  const q = searchParams.get("q");
  const mode: SearchMode | undefined = searchParams.get("mode") === "ai" ? "ai" : undefined;
  const filters = parseFiltersFromSearchParams(searchParams);

  const detectedChips =
    state.status === "success" && state.detected
      ? state.resultMode === "ai"
        ? describeAIDetectedFilters(state.detected as AIDetectedFilters)
        : describeDetectedFilters(state.detected as DetectedFilters)
      : [];
  const chips = q ? [`Search: "${q}"`, ...detectedChips] : describeFilters(filters);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    const request = q
      ? search(q, { page: filters.page, mode }, controller.signal).then((res) => ({
          listings: res.data,
          pagination: res.pagination,
          detected: res.detected,
          resultMode: res.mode,
          warning: res.warning,
        }))
      : getListings(filters, controller.signal).then((res) => ({
          listings: res.data,
          pagination: res.pagination,
          detected: null,
          resultMode: null,
          warning: null,
        }));

    request
      .then((result) => {
        setState({ status: "success", ...result });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return; // superseded by a newer request
        const message = err instanceof ApiError ? err.message : "Failed to load listings.";
        setState({ status: "error", message });
      });

    return () => {
      controller.abort();
    };
    // Depend on the serialized string, not `filters`/`searchParams` objects
    // directly — those are recreated every render and would refetch in a loop.
  }, [searchParams.toString()]);

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <Link to="/" className={styles.backLink}>
          ← New search
        </Link>
        <h1 className={styles.title}>Search results</h1>
        {state.status === "success" && state.warning && (
          <p className={styles.warning} role="alert">
            {state.warning}
          </p>
        )}
        {chips.length > 0 && (
          <div className={styles.chips}>
            {chips.map((chip) => (
              <span key={chip} className={styles.chip}>
                {chip}
              </span>
            ))}
          </div>
        )}
        {state.status === "success" && (
          <p className={styles.summary}>{state.pagination.total} listings found</p>
        )}
      </div>

      {state.status === "loading" && <p className={styles.status}>Loading listings…</p>}
      {state.status === "error" && (
        <p className={styles.status} role="alert">
          {state.message}
        </p>
      )}
      {state.status === "success" && state.listings.length === 0 && (
        <p className={styles.status}>No listings match these filters.</p>
      )}

      {state.status === "success" && state.listings.length > 0 && (
        <>
          <div className={styles.grid}>
            {state.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          <div className={styles.pagination}>
            <button
              type="button"
              onClick={() => goToPage(state.pagination.page - 1)}
              disabled={state.pagination.page <= 1}
            >
              Previous
            </button>
            <span>
              Page {state.pagination.page} of {state.pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(state.pagination.page + 1)}
              disabled={state.pagination.page >= state.pagination.totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
