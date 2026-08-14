import { useState } from "react";
import type { FormEvent } from "react";
import styles from "./styles/SearchBar.module.css";

// Visual only for now — no request is fired on submit yet.
export default function SearchBar() {
  const [query, setQuery] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: wire to GET /search once free-text search is added to the home page.
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
