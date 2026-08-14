import { useState } from "react";
import type { FormEvent } from "react";
import type { SearchMode } from "../types/search";
import styles from "./styles/SearchBar.module.css";

export interface SearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("keyword");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return; // GET /search requires a non-blank q — don't fire an invalid request
    onSearch(trimmed, mode);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} role="search">
      <input
        type="text"
        className={styles.input}
        placeholder={mode === "ai" ? "Describe what you're looking for…" : "Search by city, district, or keyword…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search listings"
      />
      <div className={styles.modeToggle} role="radiogroup" aria-label="Search mode">
        <button
          type="button"
          className={styles.modeOption}
          aria-pressed={mode === "keyword"}
          onClick={() => setMode("keyword")}
        >
          Keyword
        </button>
        <button type="button" className={styles.modeOption} aria-pressed={mode === "ai"} onClick={() => setMode("ai")}>
          AI
        </button>
      </div>
      <button type="submit" className={styles.button}>
        Search
      </button>
    </form>
  );
}
