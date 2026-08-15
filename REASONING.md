# Reasoning — Smart Real Estate Listings Platform

## 1. What data did you decide to extract, and why

I evaluated four Polish real estate marketplaces (`otodom`, `tabelaofert`, `sprzedajemy`, and `okolica`) and selected **sprzedajemy.pl** because, during my evaluation, it was the only source that consistently allowed automated requests without blocking or significant rate-limiting, making it the most reliable source for building the data pipeline.

Once the source was selected, I decided to extract the information that could be most useful to potential property buyers. The resulting dataset includes the listing title and description, location (city and district), price, price per m², whether the price is negotiable, area, number of rooms, floor, total number of floors, construction year, market type, building type, ownership form, heating, seller type, elevator availability, amenities, images, and the original listing URL.

The core property attributes—particularly **price, location, area, number of rooms, and floor**. Were considered essential because they provide a basic understanding of the property and are also useful for comparing and filtering listings. Images were also considered particularly important because visual information is a major part of how users evaluate a property, even though images are not required for the listing to be usable.

Other attributes, such as **amenities, heating, building type, ownership form, and seller type**, were given a secondary role. These attributes can provide valuable additional information when available, but they are not consistently present across all listings and therefore cannot be relied upon as the primary basis for evaluating a property.

The **original listing URL** is also preserved so that the normalized data can be compared with the original source information and so that users can access the original listing when necessary.

Finally, timestamps such as `fetchedAt`, `normalizedAt`, `createdAt`, and `updatedAt` are stored to keep track of when the data was collected and processed. This provides useful information for monitoring the freshness of the dataset and could support future functionality such as detecting stale listings or tracking changes to property information over time.

## 2. How you handled unstructured or low-quality data

The normalization stage performs both parsing and basic data validation. Listings that cannot be parsed correctly are skipped, while listings containing implausible values are filtered out. This prevents malformed or semantically incorrect data from being included in the final dataset.

One listing in the 105-item raw fixture (`sourceId 73517952`, titled *"PL/UK Bezposrednio wynajmę mieszkanie..."* — "wynajmę" means "I rent out") appeared in sprzedajemy.pl's **sale** search results despite actually being a rental advertisement.

Its price of **3,800 PLN** was correctly parsed as a number, but it was semantically incorrect for a property-sale listing. The resulting price per square meter was approximately **51 PLN/m²**, compared with **9,000+ PLN/m²** for the other listings in the dataset. This was therefore not a scraping or parsing error, but rather an incorrectly categorized listing on the source website.

To handle this case, `lib/normalize/fields.ts` provides the `isPlausibleSalePrice(pricePerM2)` validation function. It rejects listings below `MIN_PLAUSIBLE_SALE_PRICE_PER_M2`, which is set to **1,000 PLN/m²**. This threshold was chosen with sufficient headroom below the observed minimum price of approximately 9,000 PLN/m² among the legitimate sale listings.

`scripts/normalize.ts` applies this validation after parsing and records the excluded listing together with the reason for exclusion instead of silently discarding it.

As a result, **104 out of 105 listings** are included in the normalized dataset, while the anomalous rental listing is skipped and reported in the normalization run summary.

### Amenities

Amenities are currently stored as a JSON field in the database. This approach keeps the data model relatively simple and preserves the complete set of amenities associated with each listing, but it limits the ability to efficiently filter listings by individual amenities.

A possible future improvement would be to normalize amenities into a separate table and establish a many-to-many relationship between listings and amenities. This would allow users to filter properties by specific amenities and support more complex amenity-based search queries.

## 3. Where and why you used AI

AI is used for two main tasks: **listing enrichment** and **natural-language query interpretation**.

### AI-Generated Listing Summaries

The `scripts/enrich.ts` script uses the Google Gemini API to generate short, buyer-oriented summaries of property listings.

These summaries are intended to give users a quick overview of the main characteristics and potential advantages of a property without requiring them to read the complete original description.

The generated summaries are stored alongside the structured listing data and are displayed on the offer details page when available.

### AI-Powered Search

AI is also used to improve the query search system. The application provides both a deterministic keyword-based search mode and an AI-based search mode.

The keyword mode uses predefined patterns to identify expressions such as `"2 rooms"` and map them to structured filters, for example:

- **min_rooms:**: 2

Although this approach is predictable and efficient, it requires explicitly defining the different expressions that users might use to refer to each filter.

The AI search mode uses Gemini to interpret the overall meaning of a natural-language query and map it to the application's available filters. This allows users to formulate searches more naturally and with less precise wording.

This way, AI can directly recognize non-registered patters, such as `"A couple of rooms"` or `"Multiple rooms"` to set the amount of rooms filter.

This approach also makes the search system more flexible when users combine several criteria or describe their preferences in a vague, conversational way, such as:

> `Premium flat with a lot of space and at least a couple of rooms`

can be interpreted into filters such as:

- **Minimum price:** 941,750 PLN (precomputed based on price percentiles in the dataset)
- **Minimum rooms:** 2
- **Has elevator:** True
- **Minimum area:** 63 m²

## 4. One key assumption you made

I assumed that **location, price, number of rooms, and market type are among the most frequently used criteria when searching for real estate**, and therefore prioritized these fields for database indexing.

This is reflected in the database indexes:

- `@@index([city, price])` — supports filtering by city and efficiently narrowing results by price within a city.
- `@@index([rooms])` — supports searches based on the number of rooms.
- `@@index([marketType])` — supports filtering between primary and secondary market properties.

Other attributes, such as area, floor, building type, seller type and elevator access are still stored and can be used by the application, but they were not given dedicated database indexes.

This indexing strategy is based on an assumption about which filters are likely to be used most frequently. It may not accurately reflect the priorities of the actual user base. For example, users might frequently search by area, floor, elevator access, or specific amenities instead.

A future improvement would be to analyze actual search patterns and query performance to determine which filters are most commonly used and which indexes provide the greatest benefit. The indexing strategy could then be adjusted based on real usage data rather than assumptions.

## 5. One success metric for the product

I would use a **Search-to-Interest Rate** as the main success metric for the search system.

The metric would measure the percentage of users who, within their first 3 searches, select **"I'm interested"** on at least one listing.

For example, a target could be that **at least 80% of users** mark one or more listings as interesting within their first three searches.

This metric would indicate whether the search system is successfully helping users find relevant properties without requiring them to perform many repetitive searches. A high rate would suggest that the available filters and query interpretation are sufficiently aligned with users' needs.

The metric could also be used to compare different versions of the search system, such as keyword search versus AI search, and to evaluate whether changes to the available filters improve the user's ability to find relevant listings.

Finally, user abandonment after unsuccessful searches could be monitored to determine whether users who do not find an interesting listing are more likely to leave the website.

This metric ultimately tests the core assumption that the normalized attributes exposed through the search system—such as price, location, rooms, floor, elevator access, and amenities are useful for helping users identify properties that match their preferences.

## 6. One failure mode or limitation of your approach

### Marketplace Dependency and Scraper Fragility

A major limitation of the platform is its dependency on the HTML structure and availability of `sprzedajemy.pl`, which is currently the only data source used by the crawler.

The crawler relies on specific elements of the marketplace's HTML structure, such as the `a.offerLink` CSS selector used to identify listing URLs. If the marketplace changes its page structure, modifies its URL format, introduces stronger anti-bot protections, or changes the way property information is represented, the crawler may stop collecting listings or produce incomplete data.

This creates a single point of failure in the data pipeline because there is currently no fallback marketplace. Even if the rest of the application remains functional, the platform could become unable to acquire new listings until the crawler is adapted to the source changes.

A future improvement would be to support multiple data sources and implement stronger validation of crawl results. For example, the system could detect when the number of extracted listings suddenly drops below an expected threshold and report the crawler as unhealthy rather than silently producing an incomplete dataset.

## 7. What would you improve with more time

With more development time, I would prioritize the following improvements:

### Personalized Result Ordering

The current dataset is relatively small, so result ordering is not yet a major issue. With a larger dataset, I would allow users to choose how listings are sorted, for example by price, area, price per m², or relevance to their selected filters.

This would give users more control over which property characteristics they consider most important.

### User Accounts and Saved Listings

I would add user authentication and accounts, allowing users to save listings they are interested in and access them later.

User accounts could also enable **price history tracking**, allowing users to see how the price of a property changes over time and identify price reductions or other trends.

### Seller Communication

The current **"I am interested"** button is only a placeholder and does not currently provide a way to communicate with the seller.

I would implement a proper communication mechanism, such as displaying the available contact information from the original listing or providing an in-platform contact form where appropriate.

### Location-Based Enrichment

I would integrate an external mapping or geolocation service to enrich listings with additional location-based information.

For example, the platform could calculate distances to nearby:

- Schools
- Public transport and metro stations
- Healthcare facilities
- Shops and supermarkets
- Parks and other points of interest

This information could then be displayed on the offer page and potentially incorporated into the search and filtering system.