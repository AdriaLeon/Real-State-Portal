import { useState } from "react";
import type { FormEvent } from "react";
import styles from "./styles/SearchBar.module.css";

export interface SearchBarProps {
  onSearch: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return; // GET /search requires a non-blank q — don't fire an invalid request
    onSearch(trimmed);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search">
      <input
        type="text"
        className={styles.input}
        placeholder="Search by city, district, or keyword…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search listings"
      />
      <button type="submit" className={styles.button}>
        Search
      </button>
    </form>
  );
}
