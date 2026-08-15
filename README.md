# Real Estate Portal

A full-stack smart real estate listings platform that crawls, normalizes, enriches, and serves real estate data through a modern web interface with AI-powered search and summarization.

> **For architecture decisions, assumptions, and design choices, see [REASONING.md](./REASONING.md)**

## Technology Stack

### Frontend
- **React** 18.3.1 — UI library
- **Vite** 5.4.11 — Fast build tool and dev server
- **React Router DOM** 6.28.0 — Client-side routing
- **TypeScript** 5.7.2 — Type safety

### Backend
- **Node.js** with **Express** 4.21.0 — API server
- **TypeScript** 5.7.0 — Type safety
- **Prisma** 7.9.1 — ORM for database management
- **MariaDB** 8 (via Docker) — Relational database

### AI & Machine Learning
- **Google Gemini API** (@google/genai 2.17.0) — AI-powered listing summaries and search query parsing
- Generates buyer-friendly summaries (`AI_resume`) from structured listing data
- Parses natural language search queries into structured filters

### Data Crawling & Processing
- **Cheerio** 1.0.0 — Fast HTML parsing for web scraping

### Testing
- **Vitest** 2.1.0 — Fast unit and integration testing framework
- **Chai** — Assertion library

### Development Tools
- **Concurrently** 8.2.2 — Run multiple scripts in parallel
- **Docker** & **Docker Compose** — Containerized MySQL database

---

## Installation and execution

### Prerequisites
- **Node.js** 20+ and **npm** 10+
- **Docker** and **Docker Compose** (for local database)
- **Git**

### Step 1: Clone & Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd Real-State-Portal

# Install dependencies
npm install
```

### Step 2: Configure Environment Variables

1. **Copy the example `.env` file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` and set required variables:**
   - **`GEMINI_API_KEY`** **REQUIRED** for AI features (AI summaries & AI search)
     - Get a free key at: https://aistudio.google.com/apikey

## Running the Application

### Development Mode (All Services)

Start Docker, API, and frontend simultaneously:

```bash
npm run dev
```

This command:
1. Starts Docker MySQL container (`npm run dev:docker`)
2. Starts the Express API server on **port 3000** (`npm run dev:api`)
3. Starts the Vite dev server on **port 5173** (`npm run dev:front`)

**Access the app:**
- Frontend: http://localhost:5173
- API: http://localhost:3000
- API from frontend: http://localhost:5173/api (proxied through Vite)

### Running Services Individually

```bash
# Start Docker MySQL only
npm run dev:docker

# Start API only
npm run dev:api

# Start frontend only
npm run dev:front
```

---

## Uses cases

### 1. User searches for an apartment in Warszawa with an elevator and at least 2 rooms.

The user goes to the main page looking for a property that matches their requirements. They are planning to move to Warszawa with their newborn and specifically want an apartment with an elevator so they can easily access their home with a baby stroller.

They click the Filters button, which opens a form containing the available search criteria.

The user selects Warszawa from the city dropdown, enables the elevator filter, and selects blok as the building type. They then set the minimum number of rooms to 2 and click Apply.

The application searches the available listings and displays only the properties that satisfy the selected criteria. The user compares the preview information of the returned listings and selects the one that appears most relevant to their needs.

After selecting a listing, the application opens its details page, where the user can view the available images, full description, AI-generated summary (if available), and other property information.

After reviewing the listing, the user can select "I'm interested" to indicate their interest in the property. Currently, this button is a placeholder for a future seller-contact functionality.


### 2. User uses a query to search for offers without being specific with AI

The user goes to the main page looking for a property without having a precise set of requirements. They are mainly looking for something affordable, with enough space for a bedroom and a home gym, while still being relatively small and easy to maintain. They would also prefer a high floor, as they are interested in having good views of the city.

The user goes to the search bar, enables AI mode, and enters:

> `"I want a cheap place where I can fit my bedroom and a gym. A small house is fine as long as it is on a high floor."` 

After pressing Search, the AI search system interprets the natural-language query and translates the supported requirements into structured filters:

- `"Cheap place"` --> Max price: 607 475 PLN, based on the 25th percentile of prices in the dataset.
- `"Where I can fit my bedroom and a gym"` --> Min rooms: 2
- `"Small house is fine`" --> Max area: 37.75m², based on the 25th percentile of prices in the dataset.
- `"High floor"` --> Min floor: 3

The application then searches the available listings and displays only the properties that satisfy the generated criteria if they exist. Then the listing page opens, on top of it, the user can verify its query and how has it been translated into different filters.

Then, the user compares the preview information of the returned listings and selects the one that appears most relevant to their needs.

After selecting a listing, the application opens its details page, where the user can view the available images, full description, AI-generated summary (if available), and other property information.

After reviewing the listing, the user can select "I am interested" to indicate their interest in the property. Currently, this button is a placeholder for a future seller-contact functionality.

---

## Functionalities

### 1. Trending Offers

Displays the **3 cheapest available offers** in the current dataset, giving users a quick overview of low-price properties.

### 2. Filtered Search

Users can search for properties by combining multiple filters. After selecting the desired criteria, clicking **Apply** executes the search and displays the matching offers.

Filters can be left blank. When no filters are specified, the application returns **all available offers**.

### 3. Query Search

The query search provides two modes: **Keyword** and **AI**.

#### Keyword Mode

The Keyword mode uses predefined word patterns and rules to identify information in the user's query and convert it into structured search filters.

For example, the query:

> `Big 3 room Krakow`

can be interpreted as:

- **Minimum rooms:** 3
- **Maximum rooms:** 3
- **Area:** Large properties, defined as being above the 75th percentile of property area in the dataset
- **City:** Kraków

The resulting filters are then used to search the available offers.

#### AI Mode

The AI mode uses the **Google Gemini API** to interpret natural-language queries and convert them into structured search filters.

This allows users to perform searches using less precise descriptions and makes the search more tolerant of variations in wording and potential typos and different languages.

For example, a query such as:

> `Premium flat with a lot of space and at least a couple of rooms`

can be interpreted into filters such as:

- **Minimum price:** 941,750 PLN, based on price percentiles in the dataset
- **Minimum rooms:** 2
- **Has elevator:** True
- **Minimum area:** 63 m²

The generated filters are then applied to the listings search.

### 4. Offer Details Page

Clicking on an offer opens a dedicated page containing detailed information about the property.

The offer page includes:

- A **carousel of property images**
- The original **property description**
- An **AI-generated description**, when available
- A **details table** containing additional structured information about the property

This page provides users with both the original listing information and the normalized data extracted during the processing pipeline.
---

## Data Pipeline Commands

### 1. **Crawl** — Extract raw listings
```bash
npm run crawl
```
- Fetches raw HTML from real estate sources
- Outputs: raw listing data in structured format
- **Use case:** Initial data collection from external sources

### 2. **Normalize** — Clean and validate data
```bash
npm run normalize
```
- Parses and standardizes listing fields (price, area, rooms, location, etc.)
- Applies heuristics to filter invalid/implausible listings
- Outputs: normalized listings ready for enrichment
- **Use case:** Data quality assurance before AI enrichment

### 3. **Enrich** — Add AI-generated summaries
```bash
npm run enrich
```
- Generates buyer-friendly summaries (`AI_resume`) using Google Gemini
- Parses natural language search queries into structured filters
- **Requires:** `GEMINI_API_KEY` environment variable
- **Use case:** Create human-readable listing descriptions from structured data

### 4. **Seed** — Populate the database
```bash
npm run db:seed
```
- Loads processed listings into the database
- Uses data from the pipeline above
- **Use case:** One-time or reset database with clean data

### Complete Pipeline Example
```bash
# Run the full data pipeline
npm run crawl      # Extract raw data
npm run normalize  # Clean & validate
npm run enrich     # Add AI summaries
npm run db:seed    # Load into database
```

---

## Database Management

### Generate Prisma Client
```bash
npm run db:generate
```
- Regenerates the Prisma client after schema changes

### Run Migrations
```bash
npm run db:migrate
```
- Applies pending database migrations
- Creates the `shadow_database` for safe migrations

### Open Prisma Studio (GUI)
```bash
npm run db:studio
```
- Opens a web interface to browse and edit database records
- Visit: http://localhost:5555

---

## Testing

Run all tests:
```bash
npm run test
```

Run tests in watch mode:
```bash
npm run test -- --watch
```

**Test directories:**
- `tests/api/` — API endpoint tests
- `tests/ai/` — AI integration tests
- `tests/normalize/` — Data normalization tests

---

### Key Directories Explained

**`scripts/`** — Data Pipeline
- **crawl.ts:** Web scraper that extracts raw listing HTML
- **normalize.ts:** Processes raw data into structured, validated listings
- **enrich.ts:** Uses Google Gemini to generate AI summaries and parse search queries
- **seed.ts:** Inserts processed listings into the database
- Run these in order: `crawl → normalize → enrich → seed`

**`prisma/`** — Database
- **schema.prisma:** Defines the database structure (listings, searches, etc.)
- **migrations/:** Version history of schema changes
- **seed-data/:** Pre-loaded data files for initial database population

**`lib/`** — Shared Code
- **ai/:** Gemini API integration for summaries and query parsing
- **api/:** Search, filtering, and response formatting logic
- **db/:** Database queries and utilities
- **normalize/:** Field parsing and validation rules

**`app/api/`** — Express Backend
- **routes/:** HTTP endpoints for listings, search, and filters
- Returns JSON responses used by the frontend
- Connects to Prisma for database queries

**`app/front-end/`** — React Frontend
- **src/pages/:** Page components for routing
- **src/components/:** Reusable UI components
- **vite.config.ts:** Configures `/api` proxy to backend (port 3000 → 5173)