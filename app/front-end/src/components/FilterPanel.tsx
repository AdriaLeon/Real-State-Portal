import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getListingFacets } from "../api/listings";
import type { ListingFacets } from "../types/facets";
import type { ListingFilters, MarketType, SellerType } from "../types/filters";
import styles from "./styles/FilterPanel.module.css";

const EMPTY_FACETS: ListingFacets = { cities: [], districts: [], buildingTypes: [], ownershipForms: [] };

interface FilterFormState {
  city: string;
  district: string;
  minPrice: string;
  maxPrice: string;
  minArea: string;
  maxArea: string;
  minRooms: string;
  maxRooms: string;
  minFloor: string;
  maxFloor: string;
  marketType: "" | MarketType;
  sellerType: "" | SellerType;
  hasElevator: "" | "true" | "false";
  buildingType: string;
  ownershipForm: string;
}

// "" is the shared "Any" sentinel across every field, text and select alike.
const DEFAULT_FORM_STATE: FilterFormState = {
  city: "",
  district: "",
  minPrice: "",
  maxPrice: "",
  minArea: "",
  maxArea: "",
  minRooms: "",
  maxRooms: "",
  minFloor: "",
  maxFloor: "",
  marketType: "",
  sellerType: "",
  hasElevator: "",
  buildingType: "",
  ownershipForm: "",
};

// Converts form strings into the typed query-param object the API layer
// expects. Passed to onApply, which HomePage uses to navigate to
// /listings?<query> — see ListingsPage for how it's read back out.
function toListingFilters(form: FilterFormState): ListingFilters {
  const filters: ListingFilters = {};
  if (form.city) filters.city = form.city;
  if (form.district) filters.district = form.district;
  if (form.minPrice) filters.minPrice = Number(form.minPrice);
  if (form.maxPrice) filters.maxPrice = Number(form.maxPrice);
  if (form.minArea) filters.minArea = Number(form.minArea);
  if (form.maxArea) filters.maxArea = Number(form.maxArea);
  if (form.minRooms) filters.minRooms = Number(form.minRooms);
  if (form.maxRooms) filters.maxRooms = Number(form.maxRooms);
  if (form.minFloor) filters.minFloor = Number(form.minFloor);
  if (form.maxFloor) filters.maxFloor = Number(form.maxFloor);
  if (form.marketType) filters.marketType = form.marketType;
  if (form.sellerType) filters.sellerType = form.sellerType;
  if (form.hasElevator) filters.hasElevator = form.hasElevator === "true";
  if (form.buildingType) filters.buildingType = form.buildingType;
  if (form.ownershipForm) filters.ownershipForm = form.ownershipForm;
  return filters;
}

export interface FilterPanelProps {
  onApply?: (filters: ListingFilters) => void;
}

export default function FilterPanel({ onApply }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FilterFormState>(DEFAULT_FORM_STATE);
  const [facets, setFacets] = useState<ListingFacets>(EMPTY_FACETS);

  // Fetched once on mount (not on every panel open) and reused for the
  // lifetime of the component — the dropdown options rarely change.
  useEffect(() => {
    let cancelled = false;
    getListingFacets()
      .then((res) => {
        if (!cancelled) setFacets(res);
      })
      .catch(() => {
        // Non-critical: dropdowns just stay "Any"-only if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof FilterFormState>(key: K, value: FilterFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleApply(e: FormEvent) {
    e.preventDefault();
    onApply?.(toListingFilters(form));
    setIsOpen(false);
  }

  function handleReset() {
    setForm(DEFAULT_FORM_STATE);
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        Filters
      </button>

      {isOpen && (
        <div className={styles.panel} role="dialog" aria-label="Filter listings">
          <form onSubmit={handleApply} className={styles.grid}>
            <label>
              City
              <select value={form.city} onChange={(e) => update("city", e.target.value)}>
                <option value="">Any</option>
                {facets.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label>
              District
              <select value={form.district} onChange={(e) => update("district", e.target.value)}>
                <option value="">Any</option>
                {facets.districts.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Min price
              <input
                type="number"
                value={form.minPrice}
                onChange={(e) => update("minPrice", e.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              Max price
              <input
                type="number"
                value={form.maxPrice}
                onChange={(e) => update("maxPrice", e.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              Min area (m²)
              <input
                type="number"
                value={form.minArea}
                onChange={(e) => update("minArea", e.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              Max area (m²)
              <input
                type="number"
                value={form.maxArea}
                onChange={(e) => update("maxArea", e.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              Min rooms
              <input
                type="number"
                value={form.minRooms}
                onChange={(e) => update("minRooms", e.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              Max rooms
              <input
                type="number"
                value={form.maxRooms}
                onChange={(e) => update("maxRooms", e.target.value)}
                placeholder="Any"
              />
            </label>
            <label>
              Min floor
              <input
                type="number"
                value={form.minFloor}
                onChange={(e) => update("minFloor", e.target.value)}
                placeholder="Any"
                min="0"
              />
            </label>
            <label>
              Max floor
              <input
                type="number"
                value={form.maxFloor}
                onChange={(e) => update("maxFloor", e.target.value)}
                placeholder="Any"
                min="0"
              />
            </label>
            <label>
              Market type
              <select
                value={form.marketType}
                onChange={(e) => update("marketType", e.target.value as FilterFormState["marketType"])}
              >
                <option value="">Any</option>
                <option value="primary">Primary market</option>
                <option value="secondary">Secondary market</option>
              </select>
            </label>
            <label>
              Seller type
              <select
                value={form.sellerType}
                onChange={(e) => update("sellerType", e.target.value as FilterFormState["sellerType"])}
              >
                <option value="">Any</option>
                <option value="private">Private</option>
                <option value="agency">Agency</option>
              </select>
            </label>
            <label>
              Elevator
              <select
                value={form.hasElevator}
                onChange={(e) => update("hasElevator", e.target.value as FilterFormState["hasElevator"])}
              >
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label>
              Building type
              <select value={form.buildingType} onChange={(e) => update("buildingType", e.target.value)}>
                <option value="">Any</option>
                {facets.buildingTypes.map((buildingType) => (
                  <option key={buildingType} value={buildingType}>
                    {buildingType}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ownership form
              <select value={form.ownershipForm} onChange={(e) => update("ownershipForm", e.target.value)}>
                <option value="">Any</option>
                {facets.ownershipForms.map((ownershipForm) => (
                  <option key={ownershipForm} value={ownershipForm}>
                    {ownershipForm}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.actions}>
              <button type="button" onClick={handleReset}>
                Reset
              </button>
              <button type="submit" className={styles.applyButton}>
                Apply
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
