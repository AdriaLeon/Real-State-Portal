import { useNavigate } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import FilterPanel from "../components/FilterPanel";
import TrendingOffers from "../components/TrendingOffers";
import type { ListingFilters } from "../types/filters";
import styles from "./styles/HomePage.module.css";

export default function HomePage() {
  const navigate = useNavigate();

  // Encode the chosen filters into the query string and hand off to
  // ListingsPage, which reads them back out and fetches GET /listings.
  function handleApplyFilters(filters: ListingFilters) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    }
    navigate(`/listings?${params.toString()}`);
  }

  // Same destination as FilterPanel's Apply — ListingsPage sees the `q`
  // param and calls GET /search instead of GET /listings.
  function handleSearch(query: string) {
    navigate(`/listings?${new URLSearchParams({ q: query }).toString()}`);
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <h1 className={styles.title}>Find your next home</h1>
        <div className={styles.searchRow}>
          <SearchBar onSearch={handleSearch} />
          <FilterPanel onApply={handleApplyFilters} />
        </div>
      </header>

      <TrendingOffers />
    </main>
  );
}
