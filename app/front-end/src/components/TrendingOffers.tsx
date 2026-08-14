import { useEffect, useState } from "react";
import { getListings } from "../api/listings";
import { ApiError } from "../api/client";
import type { ListingSummaryDto } from "../types/listing";
import ListingCard from "./ListingCard";
import styles from "./styles/TrendingOffers.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; listings: ListingSummaryDto[] };

export default function TrendingOffers() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    getListings({ sortBy: "price", sortOrder: "asc", limit: 3 })
      .then((res) => {
        if (!cancelled) setState({ status: "success", listings: res.data });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Failed to load trending offers.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Trending offers</h2>

      {state.status === "loading" && <p className={styles.status}>Loading trending offers…</p>}
      {state.status === "error" && (
        <p className={styles.status} role="alert">
          {state.message}
        </p>
      )}
      {state.status === "success" && state.listings.length === 0 && (
        <p className={styles.status}>No listings available right now.</p>
      )}
      {state.status === "success" && state.listings.length > 0 && (
        <div className={styles.grid}>
          {state.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}
