import { useState } from "react";
import styles from "./styles/PhotoCarousel.module.css";

export interface PhotoCarouselProps {
  images: string[];
  alt: string;
}

export default function PhotoCarousel({ images, alt }: PhotoCarouselProps) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return <div className={styles.placeholder}>No photos available</div>;
  }

  function goTo(next: number) {
    setIndex((next + images.length) % images.length);
  }

  return (
    <div className={styles.carousel}>
      <div className={styles.mainImageWrapper}>
        {images.length > 1 && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.prev}`}
            onClick={() => goTo(index - 1)}
            aria-label="Previous photo"
          >
            ‹
          </button>
        )}
        <img
          src={images[index]}
          alt={`${alt} — photo ${index + 1} of ${images.length}`}
          className={styles.mainImage}
        />
        {images.length > 1 && (
          <button
            type="button"
            className={`${styles.navButton} ${styles.next}`}
            onClick={() => goTo(index + 1)}
            aria-label="Next photo"
          >
            ›
          </button>
        )}
        {images.length > 1 && (
          <span className={styles.counter}>
            {index + 1} / {images.length}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className={styles.thumbnails}>
          {images.map((src, i) => (
            <button
              type="button"
              key={src + i}
              className={`${styles.thumbnail} ${i === index ? styles.thumbnailActive : ""}`}
              onClick={() => setIndex(i)}
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === index}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
