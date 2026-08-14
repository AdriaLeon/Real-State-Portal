import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getListing } from "../api/listings";
import { ApiError } from "../api/client";
import type { ListingDetailDto } from "../types/listing";
import PhotoCarousel from "../components/PhotoCarousel";
import styles from "./styles/ListingDetailPage.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; listing: ListingDetailDto };

function formatPrice(price: number): string {
  return `${price.toLocaleString("pl-PL")} PLN`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function marketTypeLabel(marketType: string): string {
  if (marketType === "primary") return "Primary market";
  if (marketType === "secondary") return "Secondary market";
  return marketType;
}

function sellerTypeLabel(sellerType: string): string {
  if (sellerType === "agency") return "Agency";
  if (sellerType === "private") return "Private";
  return sellerType;
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState({ status: "loading" });

    getListing(id)
      .then((listing) => {
        if (!cancelled) setState({ status: "success", listing });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "Failed to load this listing.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <main className={styles.page}>
      <button type="button" className={styles.backButton} onClick={() => navigate(-1)}>
        ← Back
      </button>

      {state.status === "loading" && <p className={styles.status}>Loading listing…</p>}
      {state.status === "error" && (
        <p className={styles.status} role="alert">
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <article className={styles.article}>
          <PhotoCarousel images={state.listing.images} alt={state.listing.title} />

          <section className={styles.headline}>
            <h1 className={styles.title}>{state.listing.title}</h1>
            <p className={styles.price}>
              {formatPrice(state.listing.price)}
              {state.listing.isNegotiable && <span className={styles.negotiable}>Negotiable</span>}
            </p>
            <p className={styles.location}>
              {state.listing.district ? `${state.listing.district}, ${state.listing.city}` : state.listing.city}
            </p>

            <div className={styles.quickStats}>
              <span>{state.listing.area} m²</span>
              <span>
                {state.listing.rooms} {state.listing.rooms === 1 ? "room" : "rooms"}
              </span>
              <span>
                Floor {state.listing.floor}
                {state.listing.totalFloors ? ` of ${state.listing.totalFloors}` : ""}
              </span>
              <span>{marketTypeLabel(state.listing.marketType)}</span>
            </div>

            <button type="button" className={styles.interestedButton}>
              I'm interested
            </button>
          </section>

          {state.listing.description && (
            <section className={styles.textSection}>
              <h2>Description</h2>
              <p>{state.listing.description}</p>
            </section>
          )}

          {state.listing.aiSummary && (
            <section className={styles.textSection}>
              <h2>AI summary</h2>
              <p>{state.listing.aiSummary}</p>
            </section>
          )}

          <section className={styles.textSection}>
            <h2>Details</h2>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th>Price per m²</th>
                  <td>{formatPrice(state.listing.pricePerM2)}</td>
                </tr>
                <tr>
                  <th>Negotiable</th>
                  <td>{state.listing.isNegotiable ? "Yes" : "No"}</td>
                </tr>
                <tr>
                  <th>Year built</th>
                  <td>{state.listing.yearBuilt ?? "—"}</td>
                </tr>
                <tr>
                  <th>Building type</th>
                  <td>{state.listing.buildingType ?? "—"}</td>
                </tr>
                <tr>
                  <th>Ownership form</th>
                  <td>{state.listing.ownershipForm ?? "—"}</td>
                </tr>
                <tr>
                  <th>Heating</th>
                  <td>{state.listing.heating ?? "—"}</td>
                </tr>
                <tr>
                  <th>Seller type</th>
                  <td>{sellerTypeLabel(state.listing.sellerType)}</td>
                </tr>
                <tr>
                  <th>Elevator</th>
                  <td>{state.listing.hasElevator ? "Yes" : "No"}</td>
                </tr>
                <tr>
                  <th>Amenities</th>
                  <td>{state.listing.amenities.length > 0 ? state.listing.amenities.join(", ") : "—"}</td>
                </tr>
                <tr>
                  <th>Photos</th>
                  <td>{state.listing.imageCount}</td>
                </tr>
                <tr>
                  <th>Source</th>
                  <td>
                    <a href={state.listing.url} target="_blank" rel="noreferrer">
                      {state.listing.source}
                    </a>
                  </td>
                </tr>
                <tr>
                  <th>Fetched</th>
                  <td>{formatDate(state.listing.fetchedAt)}</td>
                </tr>
                <tr>
                  <th>Last updated</th>
                  <td>{formatDate(state.listing.updatedAt)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </article>
      )}
    </main>
  );
}
