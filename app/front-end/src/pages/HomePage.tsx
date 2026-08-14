import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import TrendingOffers from "../components/TrendingOffers";
import styles from "./styles/HomePage.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Find your next home</h1>
        <div className={styles.searchRow}>
          <SearchBar />
          <FilterPanel />
        </div>
      </header>

      <TrendingOffers />
    </main>
  );
}
