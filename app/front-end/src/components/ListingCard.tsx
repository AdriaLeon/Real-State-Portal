import { Link } from "react-router-dom";
import type { ListingSummaryDto } from "../types/listing";
import styles from "./styles/ListingCard.module.css";

function formatPrice(price: number): string {
  return `${price.toLocaleString("pl-PL")} PLN`;
}

export interface ListingCardProps {
  listing: ListingSummaryDto;
}

export default function ListingCard({ listing }: ListingCardProps) {
  const { image, price, location, size } = listing;

  return (
    <Link to={`/listings/${listing.id}`} className={styles.cardLink}>
      <article className={styles.card}>
        <div className={styles.imageWrapper}>
          {image ? (
            <img src={image} alt={`${location.city} listing`} className={styles.image} />
          ) : (
            <div className={styles.placeholder}>No image</div>
          )}
        </div>
        <div className={styles.body}>
          <p className={styles.price}>{formatPrice(price)}</p>
          <p className={styles.location}>
            {location.district ? `${location.district}, ${location.city}` : location.city}
          </p>
          <p className={styles.meta}>
            {size.area} m² · {size.rooms} {size.rooms === 1 ? "room" : "rooms"}
          </p>
        </div>
      </article>
    </Link>
  );
}
